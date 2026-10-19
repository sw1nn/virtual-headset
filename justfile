default:
    @just run

# flake check — runs everything: builds all packages, the NixOS VM tests
# (modules, runtime, extension install), the TypeScript unit tests (extension +
# panel), and treefmt
check:
    nix flake check

# add a changeset describing your change (run before opening a PR). On merge to
# main the Version PR (.github/workflows/version.yml) consumes these into a
# version bump + CHANGELOG.
changeset:
    npm run changeset

# Refuse to release from any branch other than main.
_assert-main:
    #!/usr/bin/env bash
    set -euo pipefail
    branch=$(git branch --show-current)
    if [ "$branch" != "main" ]; then
        echo "ERROR: releases can only be run from main (currently on '$branch')" >&2
        exit 1
    fi

# Bump the version, tag, run the release hooks (see cog.toml), then package.
release type='auto': _assert-main && package
    cog bump --{{ type }}

# Build the Arch package in a clean chroot and upload the current version.
package:
    #!/usr/bin/env bash
    set -euo pipefail
    pkgver=$(sed -n 's/^pkgver=//p' packaging/arch/PKGBUILD)
    sw1nn-makepkg-chroot -C packaging/arch
    sw1nn-pkg-ctl upload packaging/arch/*-"$pkgver"-*.pkg.tar.zst

# show flake outputs
show:
    nix flake show

# update all inputs
update:
    nix flake update

# build the main package
build:
    nix build

# run the main package
run:
    nix run

# These are faster, but use a separate cache. Try to use `just build/run`
# instead

build-rust:
    cargo build --manifest-path packages/virtual-headset/Cargo.toml

run-rust:
    cargo run --manifest-path packages/virtual-headset/Cargo.toml
