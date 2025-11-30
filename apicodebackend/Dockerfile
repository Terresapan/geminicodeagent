# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# We add --no-cache-dir to keep the image small
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . .

# Cloud Run expects the container to listen on port 8080 (by default)
ENV PORT=8080

# Run the application
# We use shell form to allow variable expansion for $PORT if needed, 
# but exec form is generally preferred. Here we bind to 0.0.0.0.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
