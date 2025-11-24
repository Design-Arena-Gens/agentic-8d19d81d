"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { CodeBlock } from "./CodeBlock";

type PluginMetadata = {
  pluginName: string;
  friendlyName: string;
  version: string;
  description: string;
  category: string;
  loadingPhase: "Default" | "PostDefault" | "PostEngineInit" | "PostSplash";
  supportedTargets: string;
  enableEditorModule: boolean;
  enableBlueprintLibrary: boolean;
  enableAsyncActions: boolean;
  enableEditorMenu: boolean;
};

type BlueprintParameter = {
  name: string;
  type: string;
};

type BlueprintFunction = {
  name: string;
  returnType: string;
  description: string;
  parameters: BlueprintParameter[];
};

const defaultMetadata: PluginMetadata = {
  pluginName: "NebulaToolkit",
  friendlyName: "Nebula Toolkit",
  version: "1.0.0",
  description:
    "Mission scripting utilities, smart triggers, and authoring helpers for cinematic gameplay sequences.",
  category: "Gameplay",
  loadingPhase: "PostEngineInit",
  supportedTargets: "Win64, Mac, Linux",
  enableEditorModule: true,
  enableBlueprintLibrary: true,
  enableAsyncActions: true,
  enableEditorMenu: true,
};

const defaultFunctions: BlueprintFunction[] = [
  {
    name: "PulseMissionEvent",
    returnType: "void",
    description:
      "Broadcasts a mission pulse to subscribed listeners with a contextual payload for analytics or sequencing.",
    parameters: [
      { name: "WorldContextObject", type: "UObject*" },
      { name: "EventTag", type: "FName" },
      { name: "Payload", type: "FGameplayTagContainer" },
    ],
  },
  {
    name: "GetSequenceProgress",
    returnType: "float",
    description:
      "Returns a normalized 0-1 progress value for the active master sequence, clamped for safe UI usage.",
    parameters: [
      { name: "WorldContextObject", type: "UObject*" },
      { name: "SequenceLabel", type: "FName" },
    ],
  },
];

const featureNotes: Record<keyof Pick<PluginMetadata, "enableBlueprintLibrary" | "enableEditorModule" | "enableAsyncActions" | "enableEditorMenu">, string> =
  {
    enableBlueprintLibrary:
      "Generates Blueprint function library scaffolding with metadata and logging guards.",
    enableEditorModule:
      "Adds a dedicated Editor-only module for utility menus, asset factories, and automation hooks.",
    enableAsyncActions:
      "Provides an asynchronous Blueprint action pattern backed by latent node macros.",
    enableEditorMenu:
      "Registers a streamlined editor menu entry and command binding for quick access to plugin tools.",
  };

const toPascalCase = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");

const toApiMacro = (value: string) =>
  value
    .replace(/[^A-Za-z0-9]/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, (_match, lower: string, upper: string) => `${lower}_${upper}`)
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase()
    .concat("_API");

const sanitiseIdentifier = (value: string) =>
  value
    .replace(/[^A-Za-z0-9_]/g, "")
    .replace(/^[^A-Za-z_]*/g, "")
    .replace(/^[0-9]/, "_$&");

const defaultReturnSnippet = (returnType: string) => {
  const trimmed = returnType.trim().toLowerCase();
  if (trimmed === "void") {
    return "";
  }
  if (trimmed === "bool") {
    return "return false;";
  }
  if (trimmed.includes("float") || trimmed.includes("double")) {
    return "return 0.f;";
  }
  if (trimmed.startsWith("int") || trimmed.endsWith("32") || trimmed.endsWith("64")) {
    return "return 0;";
  }
  if (trimmed === "fstring") {
    return 'return TEXT("");';
  }
  return "return {};";
};

const uniqueParameterName = (name: string, taken: Set<string>) => {
  let candidate = name;
  let index = 1;
  while (taken.has(candidate)) {
    candidate = `${name}${index++}`;
  }
  taken.add(candidate);
  return candidate;
};

export function PluginWorkbench() {
  const [metadata, setMetadata] = useState<PluginMetadata>(defaultMetadata);
  const [blueprintFunctions, setBlueprintFunctions] = useState<BlueprintFunction[]>(defaultFunctions);
  const [newFunctionName, setNewFunctionName] = useState("");
  const [newFunctionReturnType, setNewFunctionReturnType] = useState("void");
  const [newFunctionDescription, setNewFunctionDescription] = useState("");
  const [parameterDraft, setParameterDraft] = useState("ContextActor:AActor*, Countdown:float");

  const normalizedBlueprintFunctions = useMemo(() => {
    return blueprintFunctions.map((fn, index) => {
      const taken = new Set<string>();
      const sanitizedParameters = fn.parameters.map((parameter) => {
        const safeType = parameter.type.trim() || "float";
        const safeName = sanitiseIdentifier(parameter.name) || `Param${index}`;
        const unique = uniqueParameterName(safeName, taken);
        return {
          type: safeType,
          name: unique,
        };
      });

      let parameters = [...sanitizedParameters];
      let hasWorldContext =
        parameters.findIndex((parameter) => parameter.name === "WorldContextObject") !== -1;

      if (!hasWorldContext) {
        parameters = [{ name: "WorldContextObject", type: "UObject*" }, ...parameters];
        taken.add("WorldContextObject");
        hasWorldContext = true;
      }

      const returnType = fn.returnType.trim() || "void";

      const metadataSegments = [`Category="${metadata.friendlyName}|Blueprint"`];
      if (hasWorldContext) {
        metadataSegments.push('WorldContext="WorldContextObject"');
      }

      return {
        key: `${fn.name}-${index}`,
        displayName: toPascalCase(sanitiseIdentifier(fn.name) || "GeneratedFunction"),
        description: fn.description,
        returnType,
        parameters,
        metadataSegments,
      };
    });
  }, [blueprintFunctions, metadata.friendlyName]);

  const moduleName = useMemo(() => toPascalCase(metadata.pluginName || "AddonModule"), [metadata.pluginName]);
  const moduleApiMacro = useMemo(() => toApiMacro(moduleName), [moduleName]);
  const logCategory = useMemo(() => `Log${moduleName}`, [moduleName]);
  const moduleClass = useMemo(() => `F${moduleName}Module`, [moduleName]);
  const blueprintClass = useMemo(() => `U${moduleName}BlueprintLibrary`, [moduleName]);
  const asyncActionClass = useMemo(() => `U${moduleName}AsyncAction`, [moduleName]);

  const descriptorJson = useMemo(() => {
    const modules = [
      {
        Name: moduleName,
        Type: "Runtime",
        LoadingPhase: metadata.loadingPhase,
      },
    ];
    if (metadata.enableEditorModule) {
      modules.push({
        Name: `${moduleName}Editor`,
        Type: "Editor",
        LoadingPhase: "Default",
      });
    }

    return JSON.stringify(
      {
        FileVersion: 3,
        Version: 1,
        VersionName: metadata.version,
        FriendlyName: metadata.friendlyName,
        Description: metadata.description,
        Category: metadata.category,
        CreatedBy: "Unreal Addon Architect",
        CreatedByURL: "https://agentic-8d19d81d.vercel.app",
        EngineVersion: "5.3.0",
        Modules: modules,
        Plugins: metadata.enableAsyncActions
          ? [
              {
                Name: "GameplayTasks",
                Enabled: true,
              },
            ]
          : [],
        SupportedTargetPlatforms: metadata.supportedTargets.split(",").map((entry) => entry.trim()),
      },
      null,
      2
    );
  }, [
    metadata.category,
    metadata.description,
    metadata.enableAsyncActions,
    metadata.enableEditorModule,
    metadata.friendlyName,
    metadata.loadingPhase,
    metadata.supportedTargets,
    metadata.version,
    moduleName,
  ]);

  const moduleHeader = useMemo(() => {
    const editorSignature = metadata.enableEditorModule
      ? `
#if WITH_EDITOR
  void RegisterEditorUtilities();
#endif`
      : "";

    return `#pragma once

#include "Modules/ModuleInterface.h"
#include "Modules/ModuleManager.h"

DECLARE_LOG_CATEGORY_EXTERN(${logCategory}, Log, All);

class ${moduleClass} : public IModuleInterface
{
public:
  virtual void StartupModule() override;
  virtual void ShutdownModule() override;${editorSignature}
};`;
  }, [logCategory, metadata.enableEditorModule, moduleClass]);

  const moduleSource = useMemo(() => {
    const editorBody = metadata.enableEditorModule
      ? `
#if WITH_EDITOR
void ${moduleClass}::RegisterEditorUtilities()
{
  // TODO: Register asset factories, detail customizations, level snapshots, or automation tests.
}
#endif`
      : "";

    return `#include "${moduleName}.h"
#include "Logging/LogMacros.h"

DEFINE_LOG_CATEGORY(${logCategory});
IMPLEMENT_MODULE(${moduleClass}, ${moduleName});

void ${moduleClass}::StartupModule()
{
  UE_LOG(${logCategory}, Display, TEXT("${moduleName} module started."));
#if WITH_EDITOR
  if (GIsEditor)
  {
    RegisterEditorUtilities();
  }
#endif
}

void ${moduleClass}::ShutdownModule()
{
  UE_LOG(${logCategory}, Display, TEXT("${moduleName} module shut down."));
}${editorBody ? `\n${editorBody}` : ""}`;
  }, [logCategory, metadata.enableEditorModule, moduleClass, moduleName]);

  const buildScript = useMemo(() => {
    const publicDeps = new Set(["Core", "CoreUObject", "Engine"]);
    const privateDeps = new Set(["Slate", "SlateCore"]);

    if (metadata.enableBlueprintLibrary) {
      publicDeps.add("Kismet");
      privateDeps.add("UMG");
    }

    if (metadata.enableAsyncActions) {
      publicDeps.add("GameplayTasks");
    }

    if (metadata.enableEditorModule) {
      privateDeps.add("UnrealEd");
      privateDeps.add("LevelSequence");
    }

    const formatDependency = (deps: Set<string>) =>
      Array.from(deps)
        .sort()
        .map((dep) => `            "${dep}"`)
        .join(",\n");

    return `using UnrealBuildTool;

public class ${moduleName} : ModuleRules
{
    public ${moduleName}(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
${formatDependency(publicDeps)}
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
${formatDependency(privateDeps)}
        });

        if (Target.bBuildEditor)
        {
            PrivateDependencyModuleNames.AddRange(new string[]
            {
                "AssetTools",
                "EditorFramework"
            });
        }
    }
}`;
  }, [
    metadata.enableAsyncActions,
    metadata.enableBlueprintLibrary,
    metadata.enableEditorModule,
    moduleName,
  ]);

  const blueprintHeader = useMemo(() => {
    if (!metadata.enableBlueprintLibrary) {
      return "";
    }

    const functionDeclarations = normalizedBlueprintFunctions
      .map(
        (fn) => `  /**
   * ${fn.description}
   */
  UFUNCTION(BlueprintCallable, meta=(${fn.metadataSegments.join(", ")}))
  static ${fn.returnType} ${fn.displayName}(${fn.parameters
          .map((parameter) => `${parameter.type} ${parameter.name}`)
          .join(", ")});`
      )
      .join("\n\n");

    return `#pragma once

#include "Kismet/BlueprintFunctionLibrary.h"
#include "${moduleName}.h"
#include "${moduleName}BlueprintLibrary.generated.h"

UCLASS()
class ${moduleApiMacro} ${blueprintClass} : public UBlueprintFunctionLibrary
{
  GENERATED_BODY()

public:
${functionDeclarations}
};`;
  }, [
    blueprintClass,
    metadata.enableBlueprintLibrary,
    moduleApiMacro,
    moduleName,
    normalizedBlueprintFunctions,
  ]);

  const blueprintSource = useMemo(() => {
    if (!metadata.enableBlueprintLibrary) {
      return "";
    }

    const fnBodies = normalizedBlueprintFunctions
      .map((fn) => {
        const signature = fn.parameters.map((parameter) => `${parameter.type} ${parameter.name}`).join(", ");
        const guardReturn =
          fn.returnType.toLowerCase() === "void"
            ? "    return;"
            : `    ${defaultReturnSnippet(fn.returnType)}`;
        const implementationReturn =
          fn.returnType.toLowerCase() === "void"
            ? "  return;"
            : `  ${defaultReturnSnippet(fn.returnType)}`;

        return `${fn.returnType} ${blueprintClass}::${fn.displayName}(${signature})
{
  if (!WorldContextObject)
  {
    UE_LOG(${logCategory}, Warning, TEXT("${fn.displayName} called without a valid world context."));
${guardReturn}
  }

  // TODO: Implement ${fn.displayName}. ${fn.description}
${implementationReturn}
}`;
      })
      .join("\n\n");

    return `#include "${moduleName}BlueprintLibrary.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "Kismet/GameplayStatics.h"

${fnBodies}`;
  }, [
    blueprintClass,
    logCategory,
    metadata.enableBlueprintLibrary,
    moduleName,
    normalizedBlueprintFunctions,
  ]);

  const editorHeader = useMemo(() => {
    if (!metadata.enableEditorModule) {
      return "";
    }

    const editorModuleClass = `${moduleClass}Editor`;

    return `#pragma once

#include "Modules/ModuleManager.h"

class ${editorModuleClass} : public IModuleInterface
{
public:
  virtual void StartupModule() override;
  virtual void ShutdownModule() override;

private:
${metadata.enableEditorMenu ? "  void RegisterMenus();\n" : ""}  void RegisterLevelViewportExtensions();
};`;
  }, [metadata.enableEditorMenu, metadata.enableEditorModule, moduleClass]);

  const editorSource = useMemo(() => {
    if (!metadata.enableEditorModule) {
      return "";
    }

    const editorModuleClass = `${moduleClass}Editor`;
    const includes = [
      `#include "${moduleName}Editor.h"`,
      `#include "${moduleName}.h"`,
      '#include "LevelEditor.h"',
    ];
    if (metadata.enableEditorMenu) {
      includes.push('#include "ToolMenus.h"');
    }

    const startupCalls = [
      metadata.enableEditorMenu ? "  RegisterMenus();" : "",
      "  RegisterLevelViewportExtensions();",
    ]
      .filter(Boolean)
      .join("\n");

    const shutdownCalls = metadata.enableEditorMenu
      ? `  if (UToolMenus::IsInitialized())
  {
    UToolMenus::UnregisterOwner(this);
  }`
      : "";

    const menuImplementation = metadata.enableEditorMenu
      ? `
void ${editorModuleClass}::RegisterMenus()
{
  if (UToolMenus::IsInitialized() && UToolMenus::Get()->IsMenuRegistered("LevelEditor.MainMenu"))
  {
    auto* Menu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu.Tools");
    FToolMenuSection& Section = Menu->AddSection("section_${moduleName}", TEXT("${metadata.friendlyName}"));
    Section.AddMenuEntry(
      "Open${moduleName}Panel",
      FText::FromString("Open ${metadata.friendlyName} Panel"),
      FText::FromString("Launches the toolkit command panel."),
      FSlateIcon(),
      FUIAction(FExecuteAction::CreateLambda([]()
      {
        UE_LOG(${logCategory}, Display, TEXT("Launching ${metadata.friendlyName} tools panel..."));
      }))
    );
  }
}`
      : "";

    return `${includes.join("\n")}

void ${editorModuleClass}::StartupModule()
{
${startupCalls}
}

void ${editorModuleClass}::ShutdownModule()
{
${shutdownCalls}
}

void ${editorModuleClass}::RegisterLevelViewportExtensions()
{
  FLevelEditorModule& LevelEditorModule = FModuleManager::LoadModuleChecked<FLevelEditorModule>("LevelEditor");
  LevelEditorModule.OnMapChanged().AddLambda([](UWorld* World, EMapChangeType ChangeType)
  {
    UE_LOG(${logCategory}, Verbose, TEXT("${metadata.friendlyName} detected map change: %s"), *StaticEnum<EMapChangeType>()->GetNameStringByValue(static_cast<int64>(ChangeType)));
  });
}
${menuImplementation}

IMPLEMENT_MODULE(${editorModuleClass}, ${moduleName}Editor);`;
  }, [
    metadata.enableEditorMenu,
    metadata.enableEditorModule,
    metadata.friendlyName,
    moduleClass,
    moduleName,
    logCategory,
  ]);

  const asyncHeader = useMemo(() => {
    if (!metadata.enableAsyncActions) {
      return "";
    }

    return `#pragma once

#include "Kismet/BlueprintAsyncActionBase.h"
#include "${moduleName}AsyncAction.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(F${moduleName}AsyncPayload, float, Progress);

UCLASS()
class ${moduleApiMacro} ${asyncActionClass} : public UBlueprintAsyncActionBase
{
  GENERATED_BODY()

public:
  UFUNCTION(BlueprintCallable, meta=(BlueprintInternalUseOnly="true", WorldContext="WorldContextObject"))
  static ${asyncActionClass}* ExecuteTimedTask(UObject* WorldContextObject, float DurationSeconds);

  UPROPERTY(BlueprintAssignable)
  F${moduleName}AsyncPayload OnProgress;

  UPROPERTY(BlueprintAssignable)
  F${moduleName}AsyncPayload OnComplete;

  virtual void Activate() override;

private:
  void AdvanceProgress();

  float Duration = 1.f;
  float Elapsed = 0.f;
  TObjectPtr<UWorld> CachedWorld;
};`;
  }, [asyncActionClass, metadata.enableAsyncActions, moduleApiMacro, moduleName]);

  const asyncSource = useMemo(() => {
    if (!metadata.enableAsyncActions) {
      return "";
    }

    return `#include "${moduleName}AsyncAction.h"
#include "${moduleName}.h"
#include "Engine/World.h"
#include "TimerManager.h"

${asyncActionClass}* ${asyncActionClass}::ExecuteTimedTask(UObject* WorldContextObject, float DurationSeconds)
{
  ${asyncActionClass}* Action = NewObject<${asyncActionClass}>();
  Action->Duration = FMath::Max(DurationSeconds, KINDA_SMALL_NUMBER);
  Action->CachedWorld = WorldContextObject ? WorldContextObject->GetWorld() : nullptr;
  Action->RegisterWithGameInstance(WorldContextObject);
  return Action;
}

void ${asyncActionClass}::Activate()
{
  if (!CachedWorld.IsValid())
  {
    UE_LOG(${logCategory}, Warning, TEXT("Async action had no valid world."));
    OnComplete.Broadcast(1.f);
    SetReadyToDestroy();
    return;
  }

  CachedWorld->GetTimerManager().SetTimerForNextTick([this]()
  {
    AdvanceProgress();
  });
}

void ${asyncActionClass}::AdvanceProgress()
{
  if (!CachedWorld.IsValid())
  {
    OnComplete.Broadcast(1.f);
    SetReadyToDestroy();
    return;
  }

  Elapsed += CachedWorld->GetDeltaSeconds();
  const float Normalized = FMath::Clamp(Elapsed / Duration, 0.f, 1.f);
  OnProgress.Broadcast(Normalized);

  if (Normalized >= 1.f - KINDA_SMALL_NUMBER)
  {
    OnComplete.Broadcast(1.f);
    SetReadyToDestroy();
    return;
  }

  CachedWorld->GetTimerManager().SetTimerForNextTick([this]()
  {
    AdvanceProgress();
  });
}`;
  }, [asyncActionClass, logCategory, metadata.enableAsyncActions, moduleName]);

  const handleMetadataChange =
    (key: keyof PluginMetadata) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const value =
        "checked" in target && (target as HTMLInputElement).type === "checkbox"
          ? target.checked
          : target.value;
      setMetadata((previous) => ({
        ...previous,
        [key]: value,
      }));
    };

  const handleToggleFeature = (key: keyof PluginMetadata) => {
    setMetadata((previous) => ({
      ...previous,
      [key]: !(previous[key] as boolean),
    }));
  };

  const handleAddBlueprintFunction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newFunctionName.trim()) {
      return;
    }

    const parameters: BlueprintParameter[] = [];
    parameterDraft
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const [rawName, rawType] = entry.split(":").map((piece) => piece.trim());
        if (!rawName || !rawType) {
          return;
        }
        parameters.push({
          name: sanitiseIdentifier(rawName) || "Param",
          type: rawType,
        });
      });

    setBlueprintFunctions((existing) => [
      ...existing,
      {
        name: newFunctionName.trim(),
        returnType: newFunctionReturnType.trim() || "void",
        description: newFunctionDescription.trim() || "Generated function.",
        parameters,
      },
    ]);

    setNewFunctionName("");
    setNewFunctionReturnType("void");
    setNewFunctionDescription("");
    setParameterDraft("ContextActor:AActor*");
  };

  const handleRemoveBlueprintFunction = (index: number) => {
    setBlueprintFunctions((existing) => existing.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <>
      <div className="stack">
        <section className="panel">
          <h2>Plugin identity</h2>
          <p>Configure how the add-on is described inside Unreal Editor.</p>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>Plugin Code Name</span>
            <input
              name="pluginName"
              value={metadata.pluginName}
              onChange={handleMetadataChange("pluginName")}
              placeholder="NebulaToolkit"
              required
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>Friendly Name</span>
            <input
              name="friendlyName"
              value={metadata.friendlyName}
              onChange={handleMetadataChange("friendlyName")}
              placeholder="Nebula Toolkit"
              required
            />
          </label>
          <div style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>Version</span>
              <input name="version" value={metadata.version} onChange={handleMetadataChange("version")} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>Category</span>
              <input name="category" value={metadata.category} onChange={handleMetadataChange("category")} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>Loading Phase</span>
              <select name="loadingPhase" value={metadata.loadingPhase} onChange={handleMetadataChange("loadingPhase")}>
                <option value="Default">Default</option>
                <option value="PostDefault">PostDefault</option>
                <option value="PostEngineInit">PostEngineInit</option>
                <option value="PostSplash">PostSplash</option>
              </select>
            </label>
          </div>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
              Supported Target Platforms (comma separated)
            </span>
            <input
              name="supportedTargets"
              value={metadata.supportedTargets}
              onChange={handleMetadataChange("supportedTargets")}
            />
          </label>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>Description</span>
            <textarea
              name="description"
              rows={4}
              value={metadata.description}
              onChange={handleMetadataChange("description")}
            />
          </label>
        </section>

        <section className="panel">
          <h2>Feature surface</h2>
          <p>Toggle the systems your add-on should scaffold.</p>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {(Object.keys(featureNotes) as (keyof typeof featureNotes)[]).map((featureKey) => (
              <label
                key={featureKey}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  alignItems: "center",
                  gap: "0.8rem",
                  padding: "0.85rem 1rem",
                  borderRadius: "18px",
                  background: metadata[featureKey]
                    ? "linear-gradient(135deg, rgba(110, 197, 255, 0.18), rgba(110, 197, 255, 0.05))"
                    : "rgba(255, 255, 255, 0.03)",
                  border: metadata[featureKey] ? "1px solid var(--outline)" : "1px solid transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={metadata[featureKey]}
                  onChange={() => handleToggleFeature(featureKey)}
                  style={{ width: "1.1rem", height: "1.1rem" }}
                />
                <div style={{ display: "grid", gap: "0.3rem" }}>
                  <strong style={{ fontSize: "0.96rem" }}>
                    {featureKey === "enableBlueprintLibrary" && "Blueprint library"}
                    {featureKey === "enableEditorModule" && "Editor module"}
                    {featureKey === "enableAsyncActions" && "Async Blueprint action"}
                    {featureKey === "enableEditorMenu" && "Editor menu binding"}
                  </strong>
                  <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: 1.4 }}>
                    {featureNotes[featureKey]}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Blueprint endpoints</h2>
          <p>Describe the Blueprint-callable functions your gameplay designers will rely on.</p>
          <div style={{ display: "grid", gap: "0.9rem" }}>
            {blueprintFunctions.map((fn, index) => (
              <div
                key={`${fn.name}-${index}`}
                style={{
                  borderRadius: "16px",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(110, 197, 255, 0.15)",
                  padding: "0.85rem 1rem",
                  display: "grid",
                  gap: "0.35rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{toPascalCase(sanitiseIdentifier(fn.name))}</strong>
                  <button
                    type="button"
                    onClick={() => handleRemoveBlueprintFunction(index)}
                    style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}
                  >
                    Remove
                  </button>
                </div>
                <span style={{ color: "var(--foreground-muted)", fontSize: "0.85rem" }}>{fn.description}</span>
                <span style={{ fontSize: "0.78rem", color: "rgba(230, 236, 255, 0.45)" }}>
                  Returns {fn.returnType} — Params:{" "}
                  {fn.parameters.length > 0
                    ? fn.parameters.map((param) => `${param.type} ${param.name}`).join(", ")
                    : "None"}
                </span>
              </div>
            ))}
          </div>
          <form
            onSubmit={handleAddBlueprintFunction}
            style={{
              display: "grid",
              gap: "0.8rem",
              marginTop: "1.2rem",
              paddingTop: "1.2rem",
              borderTop: "1px solid rgba(110, 197, 255, 0.18)",
            }}
          >
            <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <label style={{ display: "grid", gap: "0.3rem" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>Function Name</span>
                <input
                  required
                  value={newFunctionName}
                  onChange={(event) => setNewFunctionName(event.target.value)}
                  placeholder="SpawnMissionMarker"
                />
              </label>
              <label style={{ display: "grid", gap: "0.3rem" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>Return Type</span>
                <input
                  value={newFunctionReturnType}
                  onChange={(event) => setNewFunctionReturnType(event.target.value)}
                  placeholder="void"
                />
              </label>
            </div>
            <label style={{ display: "grid", gap: "0.3rem" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>Description</span>
              <textarea
                rows={2}
                value={newFunctionDescription}
                onChange={(event) => setNewFunctionDescription(event.target.value)}
                placeholder="Explain what the node should accomplish."
              />
            </label>
            <label style={{ display: "grid", gap: "0.3rem" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>
                Parameters — Use syntax <code>Name:Type</code>
              </span>
              <textarea
                rows={2}
                value={parameterDraft}
                onChange={(event) => setParameterDraft(event.target.value)}
                placeholder="ContextActor:AActor*, TargetLocation:FVector"
              />
            </label>
            <button type="submit" className="button-primary" style={{ justifySelf: "start" }}>
              Add Blueprint Function
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Drop-in instructions</h2>
          <div className="list-muted">
            <span>
              <strong>1.</strong> Create <code>/Plugins/{metadata.pluginName}</code> inside your Unreal project.
            </span>
            <span>
              <strong>2.</strong> Paste the generated files into <code>Source/{moduleName}</code> (and{" "}
              <code>{moduleName}Editor</code> if enabled).
            </span>
            <span>
              <strong>3.</strong> Regenerate project files, then compile from Visual Studio or Rider.
            </span>
            <span>
              <strong>4.</strong> Enable the plugin in Project Settings &gt; Plugins.
            </span>
          </div>
        </section>
      </div>

      <div className="stack">
        <CodeBlock title=".uplugin descriptor" filename={`${metadata.pluginName}.uplugin`} language="json" code={descriptorJson} />

        <CodeBlock title="Runtime module header" filename={`Source/${moduleName}/${moduleName}.h`} language="cpp" code={moduleHeader} />
        <CodeBlock title="Runtime module source" filename={`Source/${moduleName}/${moduleName}.cpp`} language="cpp" code={moduleSource} />
        <CodeBlock title="Build.cs" filename={`Source/${moduleName}/${moduleName}.Build.cs`} language="csharp" code={buildScript} />

        {metadata.enableBlueprintLibrary && blueprintHeader ? (
          <>
            <CodeBlock
              title="Blueprint library header"
              filename={`Source/${moduleName}/Public/${moduleName}BlueprintLibrary.h`}
              language="cpp"
              code={blueprintHeader}
            />
            <CodeBlock
              title="Blueprint library source"
              filename={`Source/${moduleName}/Private/${moduleName}BlueprintLibrary.cpp`}
              language="cpp"
              code={blueprintSource}
            />
          </>
        ) : null}

        {metadata.enableAsyncActions && asyncHeader ? (
          <>
            <CodeBlock
              title="Async action header"
              filename={`Source/${moduleName}/Public/${moduleName}AsyncAction.h`}
              language="cpp"
              code={asyncHeader}
            />
            <CodeBlock
              title="Async action source"
              filename={`Source/${moduleName}/Private/${moduleName}AsyncAction.cpp`}
              language="cpp"
              code={asyncSource}
            />
          </>
        ) : null}

        {metadata.enableEditorModule && editorHeader ? (
          <>
            <CodeBlock
              title="Editor module header"
              filename={`Source/${moduleName}Editor/${moduleName}Editor.h`}
              language="cpp"
              code={editorHeader}
            />
            <CodeBlock
              title="Editor module source"
              filename={`Source/${moduleName}Editor/${moduleName}Editor.cpp`}
              language="cpp"
              code={editorSource}
            />
          </>
        ) : null}
      </div>
    </>
  );
}
