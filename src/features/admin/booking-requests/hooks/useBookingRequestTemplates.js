import { useEffect, useMemo, useState } from 'react';

import { DEFAULT_WHATSAPP_TEMPLATES } from '../config/default-whatsapp-templates';
import { getWhatsAppTemplateRepositoryAdapter } from '../repositories/whatsapp-template-repository';

export function useBookingRequestTemplates() {
  const adapter = getWhatsAppTemplateRepositoryAdapter();
  const [state, setState] = useState({
    loadedAdapter: null,
    templates: DEFAULT_WHATSAPP_TEMPLATES,
    error: '',
  });

  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = adapter.subscribeTemplates({
      onData: (templates) => {
        if (isCancelled) return;
        setState({
          loadedAdapter: adapter,
          templates: templates && templates.length > 0 ? templates : DEFAULT_WHATSAPP_TEMPLATES,
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setState((prev) => ({
          ...prev,
          loadedAdapter: adapter,
          error: err?.message || 'Gagal memuat template pesan WhatsApp.',
        }));
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [adapter]);

  const enabledTemplates = useMemo(
    () => state.templates.filter((tpl) => tpl.isActive !== false),
    [state.templates],
  );

  return {
    templates: state.templates,
    enabledTemplates,
    isLoading: state.loadedAdapter !== adapter && !state.error,
    error: state.error,
  };
}
