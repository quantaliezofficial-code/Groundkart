import os
import re

for root, _, files in os.walk('tests'):
    for file in files:
        if file.endswith('.py'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()

            # We want to remove `phone=...` from `create_booking(...)` calls.
            # But the easiest way is to revert my mistake and apply `phone` only for `User(` calls, or just delete it if it's after `guest_email`.
            
            # Let's just remove any `phone=...` that comes right after `guest_email=...`
            # guest_email=f"...",
            # phone=f"...",
            
            new_content = re.sub(
                r'(guest_email=[^\n]+,\n)\s+phone=[^\n]+,\n', 
                r'\1', 
                content
            )

            # also let's just make sure it's correct.
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
