import re

with open('tests/conftest.py', 'r', encoding='utf-8') as f:
    content = f.read()

# find User( ... ) and add phone.
# we can just find 'email=...' and add 'phone="1234567890",' on the next line or same line.
# let's regex replace 'email=(.*),' with 'email=\1,\n                phone="1234567890",'

new_content = re.sub(r'(email=.*,)', r'\1\n                phone="1234567890",', content)

with open('tests/conftest.py', 'w', encoding='utf-8') as f:
    f.write(new_content)
