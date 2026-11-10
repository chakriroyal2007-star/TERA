"""Create a private Compose environment with fresh local secrets; never overwrite it."""
from pathlib import Path
import os
import secrets


def main():
    root = Path(__file__).resolve().parents[1]
    target = root / '.env'
    template = (root / '.env.example').read_text()
    password = secrets.token_hex(24)
    config = template.replace('replace-with-a-random-32-plus-character-secret', secrets.token_hex(32))
    config = config.replace('tera-local-database-password', password)
    config = config.replace('tera-local-storage-secret', secrets.token_hex(32))
    try:
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        raise SystemExit('.env already exists; left unchanged. Edit it if you need to change provider settings.')
    with os.fdopen(fd, 'w') as output:
        output.write(config)
    print('Created private .env with fresh application/database secrets. Add provider credentials locally before starting Compose.')


if __name__ == '__main__':
    main()
