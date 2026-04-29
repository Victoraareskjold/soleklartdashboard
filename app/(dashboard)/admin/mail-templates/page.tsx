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
import { PlusIcon, PencilIcon, TrashIcon, XIcon, CheckIcon } from "lucide-react";

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
  const base = "px-2 py-1 text-sm border rounded transition-colors";
  const active = "bg-blue-600 text-white border-blue-600";
  const inactive = "bg-white text-gray-700 border-gray-300 hover:bg-gray-100";

  return (
    <div className="flex gap-2 border-b border-gray-200 p-2 bg-gray-50 rounded-t-md">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`${base} ${editor.isActive("bold") ? active : inactive}`}
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${base} ${editor.isActive("italic") ? active : inactive}`}
      >
        <em>I</em>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`${base} ${editor.isActive("strike") ? active : inactive}`}
      >
        <span className="line-through">S</span>
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
          "prose prose-sm m-4 min-h-32 focus:outline-none",
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
      <div className="p-8 text-center text-gray-500">
        Du har ikke tilgang til denne siden.
      </div>
    );
  }

  const isFormOpen = showCreate || editingId !== null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-postmaler</h1>
          <p className="text-sm text-gray-500 mt-1">
            Maler brukes i e-postutsending til leads. Bruk{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">&#123;leadName&#125;</code>,{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">&#123;installerName&#125;</code>,{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">&#123;estimateLink&#125;</code> som plassholdere.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <PlusIcon size={16} />
          Ny mal
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? "Rediger mal" : "Ny mal"}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Navn på mal
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="f.eks. Prisestimat"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mal-nøkkel (valgfritt)
                </label>
                <select
                  value={form.template_key}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, template_key: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Emne
              </label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Emne for e-posten"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Innhold
              </label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <MenuBar editor={editor} />
                <EditorContent editor={editor} />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Tilgjengelige plassholdere:</p>
              <div className="flex flex-wrap gap-3">
                {PLACEHOLDER_HELP.map((ph) => (
                  <span key={ph.placeholder} className="text-xs text-gray-600">
                    <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                      {ph.placeholder}
                    </code>{" "}
                    — {ph.description}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancel}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <XIcon size={14} />
                Avbryt
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-400"
              >
                <CheckIcon size={14} />
                {saving ? "Lagrer..." : "Lagre"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Laster maler...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">Ingen maler opprettet ennå.</p>
          <button
            onClick={openCreate}
            className="mt-3 text-blue-600 text-sm hover:underline"
          >
            Opprett din første mal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className={`bg-white border rounded-xl p-4 flex items-start justify-between gap-4 ${
                editingId === t.id ? "border-blue-400 ring-1 ring-blue-300" : "border-gray-200"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{t.name}</span>
                  {t.template_key && (
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                      {t.template_key}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">Emne: {t.subject}</p>
                <div
                  className="text-xs text-gray-400 mt-1 line-clamp-2 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: t.body }}
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEdit(t)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Rediger"
                >
                  <PencilIcon size={15} />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
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
