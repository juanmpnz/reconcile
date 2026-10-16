# Select polish — architecture, platform and native form semantics

Reviewer `/root/analysis_architecture`, independent from component implementation. Owns this review only. Read AGENTS and the installed pinned `@radix-ui/react-select`2.3.8 source at dist/index.mjs, especially SelectProvider and SelectBubbleInput. Official Radix documentation was consulted by the coordinator before dependency installation; this reviewer verified the concrete installed behavior rather than assuming it from a generic API description.

## Prior implementation decision

Keep the domain value unchanged, including the empty string. Radix Root.value should hold the actual raw application value; a collision-resistant internal sentinel may exist only on the optional clear menu item and must be translated to empty before calling application state handlers. Do not store/serialize a sentinel as a missing financial/business value. Derive it deterministically and ensure it does not collide with an actual option value.

The installed native bridge passes required/name/form/disabled/autocomplete and creates a native empty option when Root.value is empty and there is no registered empty native option. Therefore a controlled empty Root value can preserve native FormData empty-string and required validation semantics without adding a second named input. The bridge's programmatic change event behavior must still be exercised; source inspection is not runtime proof.

Prefer reusing that bridge rather than introducing a second select/input. If a custom native select is used instead, Root must be unnamed/non-required and exactly one authoritative named native control must serialize real raw options; no duplicate names or sentinel options can become application data. Either design must preserve external form association, disabled exclusion and native reset behavior where supported.

Required validation must focus the visible trigger and expose a readable invalid state. The native bridge is visually hidden but focusable; it does not automatically transfer native invalid focus to the trigger. A wrapper invalid capture handler can prevent the inaccessible default presentation, focus the trigger and set aria-invalid/error text while retaining the actual native constraint that blocks invalid submission. Do not bypass validation, silently pick the first nonempty option or send an internal sentinel to make the form appear valid.

## Required bounded acceptance

Test a real form: optional empty serializes empty; clear after selection serializes empty; nonempty values remain exact; no sentinel appears in FormData; exactly one named control exists; required empty prevents submit and focuses the visible trigger; valid choice permits submit; disabled controls are excluded; label/description/error association is intact; keyboard menu selection/escape/scroll work within SidePanel without closing the parent. Test external form association if used. No financial/API/auth rules change is authorized by this UI replacement.

Planning/source-bridge inspection complete and shared with frontend/coordinator before implementation. Final independent component/dependency/test-source review pending. No browser or CI success claimed here.

## Independent implementation review — 2026-10-16

Roles solution-architect and platform-engineer, reviewer `/root/analysis_architecture`, independent of component, dependency and browser-test authors. Status **passed for source/dependency scope**; actual browser execution remains QA/coordinator-owned. Read the replacement call-site diffs (19 existing single-select controls), Select component/CSS, package/lockfile and both browser runners/helper. No backend, persistence, authorization or financial rule change observed.

The wrapper preserves controlled raw values, uncontrolled initial first option, native names/required/disabled bridge, labels and visible invalid focus. Optional clear is translated before application handlers and now avoids actual option-value collisions. It does not add duplicate named controls. Existing named service/upload/invitation FormData consumers retain raw strings. No unused external-form/reset feature matrix is claimed.

SP-A1 (medium, resolved): initial internal sentinel was not collision checked; final while guard excludes all actual option values. SP-P1 (high integration risk, resolved in installed dependency source): initial Dialog1.1.15 and Select2.3.8 had separate DismissableLayer/FocusScope contexts. Exact Dialog1.2.0 pin aligns with Select2.3.8. Executed createRequire resolution comparison from both installed packages: DismissableLayer1.1.20, FocusScope1.2.0, FocusGuards1.1.6 and Portal1.1.18 all resolve to the same physical runtime module, not only the same version string. No SidePanel application code change is needed to align the shared stack. Nested modal keyboard behavior still needs the browser gate.

Independently read browser source: real required source select reportValidity returns false, trigger receives focus and aria-invalid; clear selects the actual menu item then checks native raw empty and inherited fieldset disable; named service FormData checks exact raw value; nested first Escape preserves parent Sheet, subsequent Escape closes and restores parent trigger; mobile menu bounding checks remain. These assertions use synthetic HTTP fixtures, not live server/account evidence. No checks were weakened to hide a known production defect in this reviewed delta.

Commands: inspected installed package/dist sources, git diff, rg select sites, createRequire module equality, sha256sum. Did not run broad check/build/browser concurrently with coordinator. Source fingerprints:

```text
c306ec424925e74fbab2f6aef0725d520653804ba9cd1efb449ac8cbd155919a select.tsx
a0b404db9f61f7e82746c6d7f1d15b4fda667fdcc5a9e9fb66aa1b2e473139e4 select.css
b09ea31cf2c2458ab8ba373006a82d747a211c3bdfe2b8030e3829555fed793e apps/web/package.json
dd730fb32bc0e8c4911883d13ea1a18dc3203472b80b74ea12df5faa4d5ef0a3 pnpm-lock.yaml
18e6547136d54e77dabd40dd68061c6cc6a75ab3a2351874d71c72e205d077b5 agreements.browser.mjs
b2e91f105a617d9bb429da4a69417faa82e4fdbe6d735507cb6e82ee9b286d82 workspace.browser.mjs
04515d259b84f1f80bd85971c8770eba53f83d8999b023cde66445f8979800b9 select.browser-helper.mjs
```
