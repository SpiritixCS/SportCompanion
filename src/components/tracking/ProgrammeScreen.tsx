// src/components/tracking/ProgrammeScreen.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { IconClose } from "@/components/icons/IconClose";
import { TemplateEditor } from "./TemplateEditor";
import { createTemplateAction, updateTemplateAction, deleteTemplateAction, setRotationAction } from "@/lib/tracking/actions";
import type { TemplateExerciseInput, Template } from "@/lib/tracking/templates";
import type { TrackingUnit } from "@/lib/tracking/db";
import type { Rotation } from "@/lib/tracking/program";

type EditorState = { mode: "create" } | { mode: "edit"; template: Template } | null;

function pillClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium ${active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"}`;
}

export function ProgrammeScreen({
  templates,
  rotation,
  exerciseSuggestions,
}: {
  templates: Template[];
  rotation: Rotation;
  exerciseSuggestions: { name: string; unit: TrackingUnit }[];
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorState>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave(nom: string, exercises: TemplateExerciseInput[]) {
    setSaving(true);
    setError(false);
    try {
      if (editor?.mode === "edit") {
        await updateTemplateAction(editor.template.id, nom, exercises);
      } else {
        await createTemplateAction(nom, exercises);
      }
      setEditor(null);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(templateId: number) {
    setError(false);
    try {
      await deleteTemplateAction(templateId);
      router.refresh();
    } catch {
      setError(true);
    }
  }

  async function handleToggleRotation(templateId: number) {
    setError(false);
    const currentIds = rotation.entries.map((e) => e.templateId);
    const nextIds = currentIds.includes(templateId)
      ? currentIds.filter((id) => id !== templateId)
      : [...currentIds, templateId];
    try {
      await setRotationAction(nextIds);
      router.refresh();
    } catch {
      setError(true);
    }
  }

  async function handleMoveRotation(templateId: number, direction: -1 | 1) {
    setError(false);
    const ids = rotation.entries.map((e) => e.templateId);
    const index = ids.indexOf(templateId);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await setRotationAction(ids);
      router.refresh();
    } catch {
      setError(true);
    }
  }

  if (editor) {
    return (
      <TemplateEditor
        initialNom={editor.mode === "edit" ? editor.template.nom : ""}
        initialExercises={editor.mode === "edit" ? editor.template.exercises : []}
        exerciseSuggestions={exerciseSuggestions}
        saving={saving}
        error={error}
        onSave={handleSave}
        onCancel={() => setEditor(null)}
      />
    );
  }

  const rotationIds = new Set(rotation.entries.map((e) => e.templateId));

  return (
    <div className="p-5 flex flex-col gap-8">
      <div>
        <Link href="/tracking" className="text-15 text-graphite">
          ← Retour
        </Link>
        <div className="font-archivo text-32 font-semibold leading-[1.05] mt-2">Mon programme</div>
      </div>

      {error && (
        <div className="bg-paper border border-hairline rounded-card p-6">
          <p className="text-15 text-graphite">Une erreur est survenue. Réessaie.</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setEditor({ mode: "create" })}
        className="h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
      >
        Nouveau modèle
      </button>

      {templates.length === 0 ? (
        <p className="text-15 text-graphite">Aucun modèle pour l&apos;instant.</p>
      ) : (
        <Card className="overflow-hidden">
          {templates.map((template, i) => {
            const inRotation = rotationIds.has(template.id);
            const rotationIndex = rotation.entries.findIndex((e) => e.templateId === template.id);
            return (
              <div key={template.id} className={`px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setEditor({ mode: "edit", template })} className="flex-1 text-left min-w-0">
                    <div className="text-15 font-medium">{template.nom}</div>
                    <div className="text-13 text-graphite mt-0.5">
                      {template.exercises.length} exercice{template.exercises.length > 1 ? "s" : ""}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(template.id)}
                    aria-label={`Supprimer ${template.nom}`}
                    className="text-graphite flex-none w-9 h-9 flex items-center justify-center"
                  >
                    <IconClose size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button type="button" onClick={() => handleToggleRotation(template.id)} className={pillClass(inRotation)}>
                    {inRotation ? "Dans la rotation" : "Ajouter à la rotation"}
                  </button>
                  {inRotation && (
                    <>
                      <button
                        type="button"
                        aria-label={`Monter ${template.nom} dans la rotation`}
                        onClick={() => handleMoveRotation(template.id, -1)}
                        disabled={rotationIndex === 0}
                        className="w-9 h-9 flex items-center justify-center text-graphite disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Descendre ${template.nom} dans la rotation`}
                        onClick={() => handleMoveRotation(template.id, 1)}
                        disabled={rotationIndex === rotation.entries.length - 1}
                        className="w-9 h-9 flex items-center justify-center text-graphite disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
