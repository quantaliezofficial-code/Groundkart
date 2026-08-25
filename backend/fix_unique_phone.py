import os
import re

for root, _, files in os.walk('tests'):
    for file in files:
        if file.endswith('.py'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()

            # The current static phone number replacement:
            # We want to replace phone="1234567890" with phone=f"123{uuid.uuid4().hex[:7]}"
            
            # Since uuid is already imported in many files, but maybe not all, let's just use 
            # a simple counter or uuid.
            # But the string is in python code, so we can just inject f"phone-{uuid.uuid4().hex[:8]}"
            # wait, phone is an integer-like string usually, but it can just be random digits.
            
            new_content = re.sub(
                r'phone="1234567890"', 
                r'phone=f"123{uuid.uuid4().hex[:7]}"', 
                content
            )
            # also replace "9876543210" in fix.py logic
            new_content = re.sub(
                r'phone": "9876543210"', 
                r'phone": f"123{uuid.uuid4().hex[:7]}"', 
                new_content
            )

            # Wait, `uuid` might not be imported in every test file. 
            # If we inject `uuid`, we better make sure it's imported.
            if "import uuid" not in new_content:
                new_content = "import uuid\n" + new_content
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
