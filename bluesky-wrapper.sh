#!/bin/bash
# bluesky-wrapper.sh - Wrapper script to transform Dagger output to match expected schema

# Run the original Dagger command and capture output
output=$(dagger -m github.com/levlaz/daggerverse/bluesky@v0.4.2 call post --email="$1" --password="$2" --text="$3" --host="$4")

# Check if the command was successful
if [ $? -eq 0 ]; then
    # Parse the JSON array and transform to expected format
    echo "$output" | jq '{
        success: true,
        postUrl: (if length > 0 then .[0].uri else null end),
        message: (if length > 0 then "Post sent successfully" else "No posts created")
    }'
else
    # Return error format
    echo '{
        "success": false,
        "postUrl": null,
        "message": "Failed to send post"
    }'
    exit 1
fi
