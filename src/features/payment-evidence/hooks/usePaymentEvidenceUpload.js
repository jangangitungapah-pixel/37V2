import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getPaymentEvidenceCloudinaryConfig,
  PAYMENT_EVIDENCE_UPLOAD_STATES,
} from '../config/payment-evidence-config';
import {
  mapPaymentEvidenceCloudinaryError,
  uploadPaymentEvidenceImage,
  validatePaymentEvidenceFile,
} from '../services/cloudinary-payment-evidence-upload-service';

/**
 * Reusable single-image Cloudinary upload lifecycle hook for Payment Evidence v1.
 *
 * Observable states:
 * `idle` -> `selected` -> `validating` -> `uploading` -> `uploaded` -> `saving_metadata` -> `completed` | `failed`
 *
 * Critical reliability guarantee:
 * Once Cloudinary upload succeeds, `uploadedAsset` is preserved in local state so that if a
 * subsequent Firestore write fails, retrying reuses `uploadedAsset` WITHOUT uploading a duplicate
 * image to Cloudinary.
 */
export function usePaymentEvidenceUpload({ cloudinaryConfig = null } = {}) {
  const resolvedConfig = cloudinaryConfig || getPaymentEvidenceCloudinaryConfig();

  const [uploadState, setUploadState] = useState(PAYMENT_EVIDENCE_UPLOAD_STATES.IDLE);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploadedAsset, setUploadedAsset] = useState(null);
  const [error, setError] = useState('');

  const abortControllerRef = useRef(null);
  const previewUrlRef = useRef('');
  const uploadedAssetRef = useRef(null);
  const selectedFileRef = useRef(null);

  const revokeCurrentPreview = useCallback(() => {
    if (previewUrlRef.current && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = '';
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      revokeCurrentPreview();
    };
  }, [revokeCurrentPreview]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    revokeCurrentPreview();
    selectedFileRef.current = null;
    uploadedAssetRef.current = null;
    setSelectedFile(null);
    setPreviewUrl('');
    setUploadedAsset(null);
    setProgress(0);
    setError('');
    setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.IDLE);
  }, [revokeCurrentPreview]);

  const selectFile = useCallback(
    async (file) => {
      if (!file) return false;

      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      revokeCurrentPreview();

      selectedFileRef.current = file;
      uploadedAssetRef.current = null;
      setSelectedFile(file);
      setUploadedAsset(null);
      setProgress(0);
      setError('');
      setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.VALIDATING);

      try {
        await validatePaymentEvidenceFile(file);

        let objectUrl = '';
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          try {
            objectUrl = URL.createObjectURL(file);
          } catch {
            objectUrl = '';
          }
        }
        previewUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);
        setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.SELECTED);
        return true;
      } catch (validationErr) {
        const msg = mapPaymentEvidenceCloudinaryError(validationErr, {
          uploadPreset: resolvedConfig.uploadPreset,
        });
        selectedFileRef.current = null;
        setSelectedFile(null);
        setPreviewUrl('');
        setError(msg);
        setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.FAILED);
        return false;
      }
    },
    [resolvedConfig.uploadPreset, revokeCurrentPreview],
  );

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProgress(0);
    setUploadState(
      selectedFileRef.current
        ? PAYMENT_EVIDENCE_UPLOAD_STATES.SELECTED
        : PAYMENT_EVIDENCE_UPLOAD_STATES.IDLE,
    );
  }, []);

  /**
   * Ensures the selected file is uploaded to Cloudinary once, or immediately returns the
   * already-preserved validated `uploadedAsset` if retrying a failed Firestore save.
   */
  const ensureUploaded = useCallback(async () => {
    if (uploadedAssetRef.current) {
      setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.UPLOADED);
      setProgress(100);
      setError('');
      return uploadedAssetRef.current;
    }

    const fileToUpload = selectedFileRef.current;
    if (!fileToUpload) {
      const msg = 'Please select a payment proof image before submitting.';
      setError(msg);
      setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.FAILED);
      throw new Error(msg);
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    abortControllerRef.current = controller;
    setError('');
    setProgress(5);
    setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.UPLOADING);

    try {
      const asset = await uploadPaymentEvidenceImage({
        file: fileToUpload,
        config: resolvedConfig,
        signal: controller?.signal || null,
        onProgress: (pct) => {
          setProgress(Math.min(99, Math.max(5, Number(pct) || 5)));
        },
      });
      abortControllerRef.current = null;
      uploadedAssetRef.current = asset;
      setUploadedAsset(asset);
      setProgress(100);
      setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.UPLOADED);
      return asset;
    } catch (uploadErr) {
      abortControllerRef.current = null;
      const msg = mapPaymentEvidenceCloudinaryError(uploadErr, {
        uploadPreset: resolvedConfig.uploadPreset,
      });
      setError(msg);
      setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.FAILED);
      throw uploadErr;
    }
  }, [resolvedConfig]);

  const markSavingMetadata = useCallback(() => {
    setError('');
    setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.SAVING_METADATA);
  }, []);

  const markCompleted = useCallback(() => {
    setError('');
    setProgress(100);
    setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.COMPLETED);
  }, []);

  const markMetadataFailed = useCallback((message) => {
    setError(
      message ||
        'Image uploaded, but saving the record to Firestore failed. You can retry without uploading the image again.',
    );
    setUploadState(PAYMENT_EVIDENCE_UPLOAD_STATES.FAILED);
  }, []);

  return {
    config: resolvedConfig,
    uploadState,
    selectedFile,
    previewUrl: uploadedAsset?.secureUrl || previewUrl,
    progress,
    uploadedAsset,
    hasPreservedUpload: Boolean(uploadedAsset),
    error,
    selectFile,
    cancelUpload,
    ensureUploaded,
    markSavingMetadata,
    markCompleted,
    markMetadataFailed,
    reset,
  };
}
