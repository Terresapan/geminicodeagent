from typing import Dict, Any, Optional
from google.genai import types

class PricingService:
    """
    Dedicated service for calculating Gemini API costs.
    Supports Gemini 2.5 Pro and Flash pricing structures.
    """

    PRICING_TIERS = {
        "gemini-2.5-flash": {
            "tier_1": { # Up to 128k (or 200k depending on specific SKU updates)
                "input": 0.30, 
                "output": 2.50, 
                "cache_read": 0.03, 
                "storage": 1.00
            },
            # Flash usually has flat pricing, but we keep structure for consistency
            "tier_2": { 
                "input": 0.30, 
                "output": 2.50, 
                "cache_read": 0.03, 
                "storage": 1.00
            }
        },
        "gemini-2.5-pro": {
            "tier_limit": 200_000, # Price break point based on user info
            "tier_1": { # <= 200k
                "input": 1.25, 
                "output": 10.00, 
                "cache_read": 0.125, 
                "storage": 4.50
            },
            "tier_2": { # > 200k
                "input": 2.50, 
                "output": 15.00, 
                "cache_read": 0.25, 
                "storage": 4.50
            }
        },
    }

    def get_pricing_model(self, model_name: str) -> str:
        """Normalize model string to key in PRICING_TIERS."""
        # If explicitly Pro, return Pro
        if "pro" in model_name.lower():
            return "gemini-2.5-pro"
        # Default to Flash (as requested by user configuration)
        return "gemini-2.5-flash"

    def calculate_interaction_cost(self, usage_metadata: types.GenerateContentResponseUsageMetadata, model: str) -> Dict[str, Any]:
        """
        Calculates the cost of a single generation/chat turn.
        """
        model_key = self.get_pricing_model(model)
        # Default to Flash config if key missing
        pricing_config = self.PRICING_TIERS.get(model_key, self.PRICING_TIERS["gemini-2.5-flash"])
        
        # 1. Extract Token Counts safely
        cached_tokens = getattr(usage_metadata, 'cached_content_token_count', 0) or 0
        total_prompt_tokens = getattr(usage_metadata, 'prompt_token_count', 0) or 0
        candidates_tokens = getattr(usage_metadata, 'candidates_token_count', 0) or 0
        tool_tokens = getattr(usage_metadata, 'tool_use_prompt_token_count', 0) or 0
        thoughts_tokens = getattr(usage_metadata, 'thoughts_token_count', 0) or 0
        
        # 2. Determine "New" Input vs Cached Input
        # prompt_token_count usually includes the cached tokens.
        # We pay "Input" price for (Total - Cached).
        new_input_tokens = max(0, (total_prompt_tokens - cached_tokens + tool_tokens))
        
        # 3. Determine Total Output
        total_output_tokens = candidates_tokens + thoughts_tokens

        # 4. Determine Pricing Tier (Based on TOTAL prompt size, usually)
        # Some models tier based on just input, others on context window. 
        # Using the Prompt Size is the standard heuristic.
        tier_limit = pricing_config.get("tier_limit", 128_000)
        
        if total_prompt_tokens <= tier_limit:
            rates = pricing_config["tier_1"]
        else:
            rates = pricing_config.get("tier_2", pricing_config["tier_1"])

        # 5. Calculate Costs
        input_cost = (new_input_tokens / 1_000_000) * rates["input"]
        output_cost = (total_output_tokens / 1_000_000) * rates["output"]
        cache_read_cost = (cached_tokens / 1_000_000) * rates["cache_read"]

        total_cost = input_cost + output_cost + cache_read_cost

        return {
            "model_used": model_key,
            "currency": "USD",
            "token_breakdown": {
                "new_input": new_input_tokens,
                "cached_input": cached_tokens,
                "output": total_output_tokens,
                "total": total_prompt_tokens + total_output_tokens
            },
            "cost_breakdown": {
                "input_cost": round(input_cost, 6),
                "output_cost": round(output_cost, 6),
                "cache_read_cost": round(cache_read_cost, 6),
            },
            "total_cost": round(total_cost, 6)
        }

    def calculate_storage_cost(self, cached_tokens: int, duration_minutes: float, model: str) -> float:
        """
        Calculates the storage cost for a cached file based on TTL/Duration.
        Formula: (Tokens / 1M) * (Hourly Rate) * (Minutes / 60)
        """
        model_key = self.get_pricing_model(model)
        # Default to Flash config if key missing
        pricing_config = self.PRICING_TIERS.get(model_key, self.PRICING_TIERS["gemini-2.5-flash"])
        
        # Storage rate is usually flat across tiers, taking from tier_1
        hourly_rate = pricing_config["tier_1"]["storage"]
        
        token_units = cached_tokens / 1_000_000
        hours = duration_minutes / 60.0
        
        return round(token_units * hourly_rate * hours, 6)