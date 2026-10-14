"use client";

import { useCallback, useEffect, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { useRoles } from "@/context/RoleProvider";
import {
  getMailTemplates,
  createMailTemplate,
  updateMailTemplate,
  deleteMailTemplate,
} from "@/lib/api";
import { MailTemplate } from "@/lib/types";
import { toast } from "react-toastify";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
  CheckIcon,
  MailIcon,
  Loader2Icon,
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  ShieldAlertIcon,
} from "lucide-react";

const TEMPLATE_KEYS = [
  { value: "", label: "Ingen (egendefinert)" },
  { value: "newEstimate", label: "Nytt estimat (newEstimate)" },
  { value: "followUp1", label: "Oppfølging 1 (followUp1)" },
  { value: "followUp2", label: "Oppfølging 2 (followUp2)" },
  { value: "quickQuestion", label: "Kort spørsmål (quickQuestion)" },
];

const PLACEHOLDER_HELP = [
  { placeholder: "{leadName}", description: "Kundens navn" },
  { placeholder: "{installerName}", description: "Installatørens navn" },
  { placeholder: "{estimateLink}", description: "Lenke til estimat" },
];

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null;
  const base =
    "inline-flex size-8 items-center justify-center rounded-md transition-colors";
  const active = "bg-blue-50 text-brand ring-1 ring-inset ring-blue-100";
  const inactive = "text-body hover:bg-gray-100 hover:text-ink";

  return (
    <div className="flex gap-1 border-b border-line bg-gray-50/70 px-2 py-1.5">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
        title="Fet"
        className={`${base} ${editor.isActive("bold") ? active : inactive}`}
      >
        <BoldIcon size={15} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
        title="Kursiv"
        className={`${base} ${editor.isActive("italic") ? active : inactive}`}
      >
        <ItalicIcon size={15} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
        title="Gjennomstreket"
        className={`${base} ${editor.isActive("strike") ? active : inactive}`}
      >
        <StrikethroughIcon size={15} />
      </button>
    </div>
  );
};

interface TemplateFormData {
  name: string;
  subject: string;
  body: string;
  template_key: string;
}

const emptyForm: TemplateFormData = {
  name: "",
  subject: "",
  body: "",
  template_key: "",
};

export default function MailTemplatesPage() {
  const { teamId } = useTeam();
  const { teamRole } = useRoles();

  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<TemplateFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setForm((f) => ({ ...f, body: editor.getHTML() }));
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none px-4 py-3 min-h-40 text-ink focus:outline-none",
      },
    },
  });

  const fetchTemplates = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const data = await getMailTemplates(teamId);
      setTemplates(data ?? []);
    } catch {
      toast.error("Kunne ikke hente e-postmaler");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    editor?.commands.clearContent();
    setShowCreate(true);
  };

  const openEdit = (t: MailTemplate) => {
    setShowCreate(false);
    setEditingId(t.id);
    setForm({
      name: t.name,
      subject: t.subject,
      body: t.body,
      template_key: t.template_key ?? "",
    });
    editor?.commands.setContent(t.body);
  };

  const cancel = () => {
    setEditingId(null);
    setShowCreate(false);
    setForm(emptyForm);
    editor?.commands.clearContent();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !form.name || !form.subject || !form.body) {
      toast.error("Navn, emne og innhold er påkrevd");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateMailTemplate(editingId, {
          name: form.name,
          subject: form.subject,
          body: form.body,
          template_key: form.template_key || undefined,
        });
        setTemplates((prev) =>
          prev.map((t) => (t.id === editingId ? updated : t))
        );
        toast.success("Mal oppdatert");
      } else {
        const created = await createMailTemplate(teamId, {
          name: form.name,
          subject: form.subject,
          body: form.body,
          template_key: form.template_key || undefined,
        });
        setTemplates((prev) => [...prev, created]);
        toast.success("Mal opprettet");
      }
      cancel();
    } catch {
      toast.error("Kunne ikke lagre mal");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Slett denne malen?")) return;
    setDeletingId(id);
    try {
      await deleteMailTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Mal slettet");
      if (editingId === id) cancel();
    } catch {
      toast.error("Kunne ikke slette mal");
    } finally {
      setDeletingId(null);
    }
  };

  if (teamRole !== "admin") {
    return (
      <div className="sk-page">
        <div className="sk-empty">
          <ShieldAlertIcon size={22} className="text-gray-400" />
          Du har ikke tilgang til denne siden.
        </div>
      </div>
    );
  }

  const isFormOpen = showCreate || editingId !== null;

  return (
    <div className="sk-page max-w-5xl space-y-6">
      <div className="sk-page-header !mb-0 !items-start">
        <div className="max-w-2xl">
          <p className="sk-eyebrow mb-1">Admin</p>
          <h1 className="sk-page-title">E-postmaler</h1>
          <p className="sk-page-subtitle leading-relaxed">
            Maler brukes i e-postutsending til leads. Bruk{" "}
            <code className="sk-kbd !h-auto !px-1.5 !py-0.5 font-mono !text-[11px] !text-ink">&#123;leadName&#125;</code>,{" "}
            <code className="sk-kbd !h-auto !px-1.5 !py-0.5 font-mono !text-[11px] !text-ink">&#123;installerName&#125;</code>,{" "}
            <code className="sk-kbd !h-auto !px-1.5 !py-0.5 font-mono !text-[11px] !text-ink">&#123;estimateLink&#125;</code> som plassholdere.
          </p>
        </div>
        <button onClick={openCreate} className="sk-btn sk-btn-primary">
          <PlusIcon size={16} />
          Ny mal
        </button>
      </div>

      {isFormOpen && (
        <div className="sk-card animate-pop-in overflow-hidden">
          <div className="sk-card-header">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-brand">
                {editingId ? <PencilIcon size={16} /> : <PlusIcon size={16} />}
              </div>
              <h2 className="sk-section-title">
                {editingId ? "Rediger mal" : "Ny mal"}
              </h2>
            </div>
            <button
              type="button"
              onClick={cancel}
              className="sk-icon-btn"
              title="Avbryt"
            >
              <XIcon size={16} />
            </button>
          </div>
          <form onSubmit={handleSave}>
            <div className="space-y-5 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="sk-label">Navn på mal</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="f.eks. Prisestimat"
                    className="sk-input"
                    required
                  />
                </div>
                <div>
                  <label className="sk-label">Mal-nøkkel (valgfritt)</label>
                  <select
                    value={form.template_key}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, template_key: e.target.value }))
                    }
                    className="sk-input"
                  >
                    {TEMPLATE_KEYS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="sk-label">Emne</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Emne for e-posten"
                  className="sk-input"
                  required
                />
              </div>

              <div>
                <label className="sk-label">Innhold</label>
                <div className="overflow-hidden rounded-lg border border-line bg-surface transition-[border-color,box-shadow] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(24,105,255,0.18)] hover:border-gray-300">
                  <MenuBar editor={editor} />
                  <EditorContent editor={editor} />
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-brand-soft p-4">
                <p className="sk-eyebrow mb-2.5 !text-blue-700">
                  Tilgjengelige plassholdere:
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {PLACEHOLDER_HELP.map((ph) => (
                    <span
                      key={ph.placeholder}
                      className="flex items-center gap-1.5 text-xs text-body"
                    >
                      <code className="rounded-md border border-blue-100 bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink">
                        {ph.placeholder}
                      </code>
                      — {ph.description}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-line bg-gray-50/60 px-6 py-4">
              <button
                type="button"
                onClick={cancel}
                className="sk-btn sk-btn-secondary"
              >
                <XIcon size={15} />
                Avbryt
              </button>
              <button
                type="submit"
                disabled={saving}
                className="sk-btn sk-btn-primary"
              >
                {saving ? (
                  <Loader2Icon size={15} className="animate-spin" />
                ) : (
                  <CheckIcon size={15} />
                )}
                {saving ? "Lagrer..." : "Lagre"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
          <Loader2Icon size={16} className="animate-spin text-brand" />
          Laster maler...
        </div>
      ) : templates.length === 0 ? (
        <div className="sk-empty">
          <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-blue-50 text-brand">
            <MailIcon size={20} />
          </div>
          <p className="font-medium text-ink">Ingen maler opprettet ennå.</p>
          <button
            onClick={openCreate}
            className="sk-btn sk-btn-secondary sk-btn-sm mt-2"
          >
            <PlusIcon size={14} />
            Opprett din første mal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className={`sk-card group flex items-start justify-between gap-4 p-5 transition-all hover:shadow-pop ${
                editingId === t.id
                  ? "!border-brand ring-2 ring-blue-100"
                  : "hover:border-gray-300"
              }`}
            >
              <div className="flex min-w-0 flex-1 gap-3.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-muted transition-colors group-hover:bg-blue-50 group-hover:text-brand">
                  <MailIcon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold text-ink">{t.name}</span>
                    {t.template_key && (
                      <span className="sk-badge sk-badge-brand font-mono">
                        {t.template_key}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-body">
                    <span className="text-muted">Emne:</span> {t.subject}
                  </p>
                  <div
                    className="prose prose-sm mt-1.5 line-clamp-2 max-w-none text-xs text-muted"
                    dangerouslySetInnerHTML={{ __html: t.body }}
                  />
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => openEdit(t)}
                  className="sk-icon-btn hover:!bg-blue-50 hover:!text-brand"
                  title="Rediger"
                >
                  <PencilIcon size={15} />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  className="sk-icon-btn hover:!bg-red-50 hover:!text-red-600"
                  title="Slett"
                >
                  <TrashIcon size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
