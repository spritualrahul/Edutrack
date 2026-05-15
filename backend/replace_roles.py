import os

ROLE_MAP = {
    "org:super_admin": "org:super_admin",
    "org:school_admin": "org:school_admin",
    "org:accounts": "org:accounts",
    "org:teacher": "org:teacher",
    "org:parent": "org:parent",
    "org:student": "org:student"
}

def replace_roles(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith((".py", ".ts", ".tsx")):
                filepath = os.path.join(root, file)
                with open(filepath, "r") as f:
                    content = f.read()
                
                original_content = content
                for old, new in ROLE_MAP.items():
                    # Look for quoted versions
                    content = content.replace(f'"{old}"', f'"{new}"')
                    content = content.replace(f"'{old}'", f"'{new}'")
                
                # Specific fixes
                content = content.replace("navItemsByRole["org:school_admin"]", "navItemsByRole[\"org:school_admin\"]")
                content = content.replace("navItemsByRole["org:student"]", "navItemsByRole[\"org:student\"]")
                
                if content != original_content:
                    with open(filepath, "w") as f:
                        f.write(content)
                    print(f"Updated {filepath}")

replace_roles(".")
replace_roles("../frontend/src")
