import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Check, Plus, RotateCcw, Save, X } from 'lucide-react';
import { toast } from 'sonner';

import { AdminButton, AdminStatusBadge } from '@/features/admin/design-system';

import {
  ALLOWLISTED_TEMPLATE_VARIABLES,
  WHATSAPP_TEMPLATE_CATEGORIES,
} from '../config/default-whatsapp-templates';
import { useBookingRequestTemplates } from '../hooks/useBookingRequestTemplates';
import {
  restoreDefaultWhatsAppTemplate,
  saveWhatsAppTemplate,
  toggleWhatsAppTemplateActive,
} from '../services/whatsapp-message-service';
import { renderWhatsAppTemplate } from '../utils/whatsapp-template-renderer';

const SAMPLE_PREVIEW_VARIABLES = {
  customerName: 'Raka Pratama',
  bandName: 'Midnight Static',
  requestReference: 'REQ-SAMPLE01',
  serviceName: 'Rehearsal',
  roomName: 'Room A — Live Room',
  preferredDate: 'Rabu, 25 November 2026',
  preferredTime: '19:00',
  duration: '2 jam',
  confirmedDate: 'Rabu, 25 November 2026',
  confirmedTime: '19:00',
  confirmedEndTime: '21:00',
  bookingReference: 'BKG-SAMPLE01',
  studioName: '37 Music Studio',
};

export function WhatsAppTemplateManager({ open, onOpenChange, actorUid, actorRole }) {
  const { templates } = useBookingRequestTemplates();
  const isOwner = String(actorRole || '').toLowerCase() === 'owner';

  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOwner) return null;

  const startCreateNew = () => {
    setErrorMsg('');
    setEditingTemplate({
      id: '',
      label: '',
      category: WHATSAPP_TEMPLATE_CATEGORIES.FOLLOW_UP,
      description: '',
      body: 'Halo {customerName}, terima kasih sudah menghubungi {studioName} terkait request {requestReference}.',
      isActive: true,
      isBuiltIn: false,
      requiresConfirmedBooking: false,
    });
  };

  const startEdit = (tpl) => {
    setErrorMsg('');
    setEditingTemplate({
      id: tpl.id,
      label: tpl.label,
      category: tpl.category,
      description: tpl.description || '',
      body: tpl.body,
      isActive: tpl.isActive !== false,
      isBuiltIn: Boolean(tpl.isBuiltIn),
      requiresConfirmedBooking: Boolean(tpl.requiresConfirmedBooking),
      sortOrder: tpl.sortOrder,
    });
  };

  const handleSaveEditor = async (event) => {
    event.preventDefault();
    if (!editingTemplate || isSaving) return;
    setIsSaving(true);
    setErrorMsg('');

    try {
      await saveWhatsAppTemplate({
        actorUid,
        actorRole,
        templateInput: editingTemplate,
      });
      toast.success(`Template "${editingTemplate.label}" berhasil disimpan.`);
      setEditingTemplate(null);
    } catch (err) {
      setErrorMsg(err?.message || 'Gagal menyimpan template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (tpl) => {
    try {
      await toggleWhatsAppTemplateActive({
        actorUid,
        actorRole,
        template: tpl,
        isActive: !tpl.isActive,
      });
      toast.success(`Template "${tpl.label}" ${!tpl.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err) {
      toast.error(err?.message || 'Gagal mengubah status template.');
    }
  };

  const handleRestoreDefault = async (templateId) => {
    try {
      await restoreDefaultWhatsAppTemplate({ actorUid, actorRole, templateId });
      toast.success('Template dikembalikan ke versi default.');
      if (editingTemplate?.id === templateId) {
        setEditingTemplate(null);
      }
    } catch (err) {
      toast.error(err?.message || 'Gagal merestore template default.');
    }
  };

  const livePreview = editingTemplate
    ? renderWhatsAppTemplate(editingTemplate.body, SAMPLE_PREVIEW_VARIABLES)
    : null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-50"
        />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          <Dialog.Popup
            data-admin-portal-layer="true"
            aria-label="Kelola Template Pesan WhatsApp"
            className="sa-dialog flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#FAF8F1]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#151515] px-5 py-4 text-[#F1EEE4]">
              <div>
                <span className="inline-block rounded-full bg-[#C8F13A] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#151515] uppercase">
                  OWNER ONLY · WHATSAPP TEMPLATES
                </span>
                <Dialog.Title className="mt-1 text-lg font-bold text-white">
                  Kelola Template Pesan WhatsApp
                </Dialog.Title>
                <Dialog.Description className="text-xs text-neutral-400">
                  Template internal untuk pesan siap kirim Staff melalui WhatsApp Click to Chat.
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Tutup pengelola template"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white hover:text-[#C8F13A]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {editingTemplate ? (
                <form onSubmit={handleSaveEditor} className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-[#151515]">
                      {editingTemplate.id
                        ? `Edit Template: ${editingTemplate.label}`
                        : 'Buat Template Baru'}
                    </h3>
                    <AdminButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingTemplate(null)}
                    >
                      Batal
                    </AdminButton>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="tpl-label-input"
                        className="block text-xs font-semibold text-[#151515]"
                      >
                        Nama Template
                      </label>
                      <input
                        id="tpl-label-input"
                        type="text"
                        required
                        value={editingTemplate.label}
                        onChange={(e) =>
                          setEditingTemplate((p) => ({ ...p, label: e.target.value }))
                        }
                        className="sa-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="tpl-category-select"
                        className="block text-xs font-semibold text-[#151515]"
                      >
                        Kategori
                      </label>
                      <select
                        id="tpl-category-select"
                        value={editingTemplate.category}
                        onChange={(e) =>
                          setEditingTemplate((p) => ({ ...p, category: e.target.value }))
                        }
                        className="sa-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                      >
                        {Object.values(WHATSAPP_TEMPLATE_CATEGORIES).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="tpl-desc-input"
                      className="block text-xs font-semibold text-[#151515]"
                    >
                      Deskripsi Penggunaan
                    </label>
                    <input
                      id="tpl-desc-input"
                      type="text"
                      value={editingTemplate.description}
                      onChange={(e) =>
                        setEditingTemplate((p) => ({ ...p, description: e.target.value }))
                      }
                      className="sa-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="tpl-body-textarea"
                        className="block text-xs font-semibold text-[#151515]"
                      >
                        Isi Template Pesan
                      </label>
                      <span className="text-[11px] text-[#666159]">
                        Klik variabel untuk menyisipkan:
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {ALLOWLISTED_TEMPLATE_VARIABLES.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() =>
                            setEditingTemplate((p) => ({
                              ...p,
                              body: `${p.body}{${v}}`,
                            }))
                          }
                          className="cursor-pointer rounded-md border border-[#151515]/15 bg-white px-2 py-0.5 font-mono text-[11px] text-[#151515] hover:bg-[#EDF8C2]"
                        >
                          +{`{${v}}`}
                        </button>
                      ))}
                    </div>

                    <textarea
                      id="tpl-body-textarea"
                      rows={6}
                      required
                      value={editingTemplate.body}
                      onChange={(e) => setEditingTemplate((p) => ({ ...p, body: e.target.value }))}
                      className="sa-input mt-2 w-full rounded-xl p-3 font-mono text-xs sm:text-sm"
                    />
                  </div>

                  {livePreview ? (
                    <div className="rounded-xl border border-[#151515]/10 bg-white p-3.5 text-xs">
                      <p className="font-mono text-[10px] font-bold text-[#666159] uppercase">
                        Preview Hasil Render (Contoh Data)
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-[#151515]">
                        {livePreview.renderedText}
                      </p>
                      {livePreview.unknownVariables.length > 0 ? (
                        <p className="mt-2 font-semibold text-red-700">
                          Variabel tidak dikenal:{' '}
                          {livePreview.unknownVariables.map((v) => `{${v}}`).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {errorMsg ? (
                    <p role="alert" className="text-xs font-semibold text-red-700">
                      {errorMsg}
                    </p>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <AdminButton type="submit" variant="primary" disabled={isSaving}>
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isSaving ? 'Menyimpan...' : 'Simpan Template'}</span>
                    </AdminButton>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <AdminButton variant="primary" size="sm" onClick={startCreateNew}>
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Buat Template Baru</span>
                    </AdminButton>
                  </div>

                  <div className="space-y-2.5">
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="flex flex-col justify-between gap-3 rounded-2xl border border-[#151515]/10 bg-white p-4 sm:flex-row sm:items-start"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-[#151515]">{tpl.label}</h4>
                            <AdminStatusBadge tone={tpl.isActive ? 'emerald' : 'neutral'} size="sm">
                              {tpl.isActive ? 'Aktif' : 'Nonaktif'}
                            </AdminStatusBadge>
                            {tpl.requiresConfirmedBooking ? (
                              <AdminStatusBadge tone="ink" size="sm">
                                Confirmed Only
                              </AdminStatusBadge>
                            ) : null}
                          </div>
                          {tpl.description ? (
                            <p className="text-xs text-[#666159]">{tpl.description}</p>
                          ) : null}
                          <p className="line-clamp-2 font-mono text-[11px] text-[#46433D]">
                            {tpl.body}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-1.5">
                          <AdminButton
                            variant="secondary"
                            size="xs"
                            onClick={() => handleToggleActive(tpl)}
                          >
                            <Check className="h-3 w-3" aria-hidden="true" />
                            <span>{tpl.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                          </AdminButton>
                          <AdminButton variant="secondary" size="xs" onClick={() => startEdit(tpl)}>
                            Edit
                          </AdminButton>
                          {tpl.isBuiltIn ? (
                            <AdminButton
                              variant="ghost"
                              size="xs"
                              onClick={() => handleRestoreDefault(tpl.id)}
                            >
                              <RotateCcw className="h-3 w-3" aria-hidden="true" />
                              <span>Default</span>
                            </AdminButton>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
