import { PluginWorkbench } from "@/components/PluginWorkbench";

export default function Home() {
  return (
    <main className="main-shell">
      <section className="hero">
        <span className="tag">Unreal Engine 5 plugin generator</span>
        <h1>Craft production-ready Unreal add-ons without leaving the browser.</h1>
        <p>
          Architect module scaffolding, blueprint libraries, and editor utilities with
          live code previews. Export a complete plugin foundation tailored to your
          project&apos;s needs, ready to drop into your Unreal workspace.
        </p>
        <a className="button-primary" href="#workbench">
          Launch Workbench
        </a>
      </section>

      <section className="grid" aria-label="Key capabilities">
        <article className="panel">
          <h2>Code that compiles</h2>
          <p>
            Generates consistent `.uplugin`, module, and build artifacts aligned with
            Unreal Engine 5 best practices and module loading phases.
          </p>
        </article>
        <article className="panel">
          <h2>Blueprint-first</h2>
          <p>
            Produce `UBlueprintFunctionLibrary` stubs dynamically, complete with metadata
            and parameter macros for instant Blueprint exposure.
          </p>
        </article>
        <article className="panel">
          <h2>Editor ready</h2>
          <p>
            Toggle optional editor utilities, asset menus, and real-time preview commands
            to keep your team productive inside Unreal Editor.
          </p>
        </article>
      </section>

      <div id="workbench" className="two-column" style={{ marginTop: "4rem" }}>
        <PluginWorkbench />
      </div>
    </main>
  );
}
