{
  description = "TypeScript definitions for the Frappe Framework desk JS API";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";

    # ------------------------------------------------------------------------ #
    # THE FRAPPE THIS BRANCH IS TYPES FOR.                                      #
    #                                                                           #
    # `flake = false`: frappe is a source tree, not a flake — the same shape    #
    # carbon_frappe pins it in.                                                 #
    #                                                                           #
    # This one line is the branch's declaration of which frappe major it        #
    # targets, and `flake.lock` pins the exact revision. That matters more here #
    # than it looks: every number this package publishes about itself — the     #
    # coverage percentage, `frappe.verifiedAgainst`, the whole premise that a   #
    # declaration was "verified against frappe source" — is a claim ABOUT a     #
    # particular frappe tree. Before this input, that tree was whatever         #
    # `scripts/audit-coverage.mjs` happened to find on the filesystem:          #
    # `../frappe` is tried before the bench, and on a machine with a `develop`  #
    # clone sitting there the audit silently measured the v16 typeset against   #
    # frappe 17.0.0-dev and reported a 3-path "regression" that did not exist.  #
    # A pinned input makes the tree an input rather than an accident, identical #
    # locally and in CI, and moved only by a reviewable dependabot pull request #
    # (see .github/dependabot.yml, `package-ecosystem: nix`).                   #
    #                                                                           #
    # A new frappe major gets a new BRANCH of this repo with this url changed   #
    # to `version-17` — never a second input here. See README, "Upgrading to a  #
    # new frappe major".                                                        #
    # ------------------------------------------------------------------------ #
    frappe = {
      url = "github:frappe/frappe/version-16";
      flake = false;
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      frappe,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        inherit (pkgs) lib stdenvNoCC;

        # Matches `.github/workflows/*.yml` and package.json `engines`.
        nodejs = pkgs.nodejs_24;

        src = self;
        pkg = builtins.fromJSON (builtins.readFile ./package.json);
        inherit (pkg) version;

        # frappe's own version string, read from the PINNED tree. Everything that
        # wants to know "which frappe?" reads it from here rather than from
        # package.json, so there is exactly one answer and `checks.verified-against`
        # can assert package.json agrees with it.
        frappeVersion =
          let
            lines = lib.splitString "\n" (builtins.readFile "${frappe}/frappe/__init__.py");
            hit = lib.findFirst (l: lib.hasPrefix "__version__" l) null lines;
          in
          if hit == null then
            throw "could not read __version__ from the pinned frappe source"
          else
            # `__version__ = "16.33.0"` splits on the quote into
            # [ ''__version__ = '' "16.33.0" "" ], so the value is element 1.
            lib.elemAt (lib.splitString "\"" hit) 1;

        # node_modules from package-lock.json. `importNpmLock` fetches each tarball
        # as its own fixed-output derivation straight out of the lockfile, so there
        # is no vendor hash to maintain and dependabot's npm updates need no
        # companion commit here — which is the whole reason this repo can put the
        # npm and nix ecosystems on autopilot together.
        npmDeps = pkgs.importNpmLock { npmRoot = src; };

        # Every check is the same shape: a source tree, real node_modules, one
        # command. They are separate derivations rather than one script so that
        # `nix flake check` names the thing that broke, and so a slow check
        # (coverage probes ~2000 paths through tsc) cannot mask a fast one.
        mkCheck =
          name: script:
          stdenvNoCC.mkDerivation {
            name = "frappe-types-${name}-${version}";
            inherit src npmDeps;
            nativeBuildInputs = [
              nodejs
              pkgs.importNpmLock.npmConfigHook
            ];
            # The pinned tree, for the scripts that take `--frappe`/`FRAPPE_PATH`.
            FRAPPE_PATH = "${frappe}";
            buildPhase = ''
              runHook preBuild
              ${script}
              runHook postBuild
            '';
            installPhase = "touch $out";
            dontFixup = true;
          };
      in
      {
        checks = {
          # The package's premise: it type-checks with `skipLibCheck: false`.
          typecheck = mkCheck "typecheck" "npm run check";

          # The ratchet, against the PINNED frappe rather than whatever is lying
          # around. `--frappe` is passed explicitly even though FRAPPE_PATH is set,
          # because being explicit here is the entire point of the exercise.
          coverage = mkCheck "coverage" "node scripts/audit-coverage.mjs --frappe ${frappe} --strict --top 25";

          # The package major must be the frappe major (scripts/check-frappe-major.mjs).
          frappe-major = mkCheck "frappe-major" "npm run check:major";

          # package.json's `frappe.verifiedAgainst` is a published claim about which
          # frappe tag these declarations were checked against. Now that the tree is
          # pinned, that claim is checkable — so it is checked, rather than being a
          # string somebody remembers to update.
          #
          # This is what makes a dependabot bump of the `frappe` input honest: moving
          # the pin without re-stating what was verified would leave the package
          # advertising a tag it is no longer built against. The failure prints the
          # exact value to paste, because the fix is a one-line edit that lands in the
          # same pull request as the lock bump.
          verified-against = mkCheck "verified-against" ''
            claimed="$(node -p 'require("./package.json").frappe.verifiedAgainst')"
            pinned="v${frappeVersion}"
            if [ "$claimed" != "$pinned" ]; then
              echo "package.json frappe.verifiedAgainst is '$claimed', but flake.lock pins $pinned." >&2
              echo "" >&2
              echo "The pin moved (a dependabot nix update, or a deliberate bump) and the" >&2
              echo "published claim did not follow. Set it to:" >&2
              echo "" >&2
              echo "    \"verifiedAgainst\": \"$pinned\"" >&2
              echo "" >&2
              echo "and re-record coverage if the ratchet also moved:" >&2
              echo "    nix develop -c npm run coverage -- --update-baseline" >&2
              exit 1
            fi
            echo "verifiedAgainst $claimed matches the pinned frappe source"
          '';
        };

        # `nix build` — the tarball npm would publish, built reproducibly. Useful for
        # inspecting exactly what ships (the package is `.d.ts` files and nothing
        # else, so `files` in package.json is the only thing standing between a
        # consumer and 200 MB of node_modules).
        #
        # This is NOT how a release is published: publish.yml runs `npm publish` so
        # that npm's OIDC trusted publishing and the provenance attestation apply.
        packages.default = stdenvNoCC.mkDerivation {
          pname = "frappe-types-tarball";
          inherit src version;
          nativeBuildInputs = [ nodejs ];
          buildPhase = ''
            runHook preBuild
            # The sandbox sets HOME=/homeless-shelter, which is not writable, and
            # `npm pack` still wants a cacache directory even though it fetches
            # nothing. Point both at the build dir.
            export HOME="$TMPDIR"
            export npm_config_cache="$TMPDIR/.npm"
            npm pack --ignore-scripts --pack-destination .
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            mkdir -p "$out"
            cp ./*.tgz "$out/"
            runHook postInstall
          '';
          dontFixup = true;
        };

        devShells.default = pkgs.mkShell {
          # npm ships inside the nodejs derivation; there is no separate package.
          packages = [ nodejs ];

          # The one thing this shell exists to guarantee. `scripts/audit-coverage.mjs`
          # and `scripts/audit-consumer.mjs` both resolve a frappe checkout, and left
          # to their own devices they take the first one that exists — which on a
          # machine that also has a `develop` clone is the wrong major, silently.
          # Exporting the pin means `npm test` in this shell measures the same tree CI
          # does. (The script still refuses a cross-major checkout on its own; this
          # makes sure it never has to.)
          FRAPPE_PATH = "${frappe}";

          shellHook = ''
            echo "node $(node --version), npm $(npm --version)"
            echo "frappe v${frappeVersion} (pinned) -> $FRAPPE_PATH"
          '';
        };
      }
    );
}
