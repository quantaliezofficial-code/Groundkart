import os
import re

for root, _, files in os.walk("tests"):
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Find any signup payload with email and add phone.
            # actually replacing all 'password": "..."' with 'password": "...", "phone": "1234567890"'
            # might break login tests if LoginRequest doesn't ignore extra kwargs.
            # Pydantic v2 by default ignores extra kwargs unless `extra="forbid"` is set.
            # Let's check schemas/auth.py. It does not forbid.
            
            # Let's do a safe replace: only in lines with 'name' or 'signup' or 'email'
            
            lines = content.split('\n')
            new_lines = []
            for line in lines:
                if '"password":' in line and ('"email":' in line or '"login_id":' in line):
                    # Replace
                    line = re.sub(r'("password":\s*"[^"]+")', r'\1, "phone": "9876543210"', line)
                new_lines.append(line)
            
            new_content = '\n'.join(new_lines)
            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
