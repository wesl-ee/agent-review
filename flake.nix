{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url  = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { system = system; };
        isDarwin = pkgs.stdenv.isDarwin;
      in {
        packages.default = pkgs.buildNpmPackage {
          pname = "agent-review";
          version = "0.1.0";
          src = ./.;

          npmDepsHash = "sha256-wXcmZUlbiBzB1UakquAOmsIcpvyUWWPvVdOFi1NDbw0=";

          buildPhase = ''
            npm run build
          '';

          installPhase = ''
            mkdir -p $out
            cp -r .next/standalone/* $out/ || true
            mkdir -p $out/.next
            [ -d .next/static ] && cp -r .next/static $out/.next/static || true
            [ -d public ] && cp -r public $out/public || true
          '';
        };

        devShells.default = with pkgs; mkShell {
          buildInputs = [
          just
          nodejs
          # You can set the major version of Node.js to a specific one instead
          # of the default version
          # pkgs.nodejs-19_x

          # You can choose pnpm, yarn, or none (npm).
          nodePackages.pnpm
          nodePackages.prettier
          # pkgs.yarn

          nodePackages.typescript
          nodePackages.typescript-language-server
          ] ++ pkgs.lib.optional isDarwin (with darwin.apple_sdk.frameworks; [ Security CoreServices ]);
        };
      }
    );
}
