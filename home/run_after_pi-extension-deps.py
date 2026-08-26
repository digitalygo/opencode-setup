#!/usr/bin/env python3

import os
import shutil
import subprocess
import sys
from pathlib import Path


def mise_npm_command(mise):
    node_result = subprocess.run(
        [mise, "which", "node"],
        capture_output=True,
        text=True,
        check=False,
    )
    npm_result = subprocess.run(
        [mise, "which", "npm"],
        capture_output=True,
        text=True,
        check=False,
    )
    if node_result.returncode != 0 or npm_result.returncode != 0:
        return None

    node = Path(node_result.stdout.strip()).resolve()
    npm_launcher = Path(npm_result.stdout.strip()).resolve()
    if not node.is_file() or not npm_launcher.is_file():
        return None

    npm_cli = node.parent.parent / "lib" / "node_modules" / "npm" / "bin" / "npm-cli.js"
    if not npm_cli.is_file():
        return None

    return [str(node), str(npm_cli)]


def npm_command():
    mise = shutil.which("mise")
    if mise is not None:
        command = mise_npm_command(mise)
        if command is not None:
            return command

    npm = shutil.which("npm")
    if npm is not None:
        return [npm]

    return None


def main():
    extensions_dir = Path.home() / ".pi" / "agent" / "extensions"
    if not extensions_dir.is_dir():
        return 0

    command = npm_command()
    if command is None:
        return 0

    environment = None
    if len(command) == 2:
        environment = os.environ.copy()
        node_bin = str(Path(command[0]).parent)
        environment["PATH"] = node_bin + os.pathsep + environment.get("PATH", "")

    for package_json in sorted(extensions_dir.glob("*/package.json")):
        extension_dir = package_json.parent
        lock_file = extension_dir / "package-lock.json"
        modules_dir = extension_dir / "node_modules"
        if (
            modules_dir.is_dir()
            and lock_file.is_file()
            and modules_dir.stat().st_mtime > lock_file.stat().st_mtime
        ):
            continue
        subprocess.run(
            [*command, "ci", "--omit=dev", "--no-audit", "--no-fund"],
            cwd=str(extension_dir),
            env=environment,
            check=True,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
