import os

REVERSE_ROLE_MAP = {
    "org:super_admin": "super_admin",
    "org:school_admin": "school_admin",
    "org:accounts": "accountant",
    "org:teacher": "teacher",
    "org:parent": "parent",
    "org:student": "student"
}

def replace_roles(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith((".py", ".ts", ".tsx")):
                filepath = os.path.join(root, file)
                with open(filepath, "r") as f:
                    content = f.read()
                
                original_content = content
                for old, new in REVERSE_ROLE_MAP.items():
                    content = content.replace(f'"{old}"', f'"{new}"')
                    content = content.replace(f"'{old}'", f"'{new}'")
                
                if content != original_content:
                    with open(filepath, "w") as f:
                        f.write(content)
                    print(f"Reverted {filepath}")

replace_roles("venv")
