import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  parseDurationToMinutes,
  parseTimeStringToMinute,
} from '@/features/admin/booking-requests/utils/booking-request-normalize';
import {
  OPERATING_END_MINUTE,
  OPERATING_START_MINUTE,
  SLOT_INTERVAL_MINUTES,
} from '@/features/admin/calendar/config/calendar-config';
import { isValidPhoneNumber } from '@/features/admin/customer/utils/phone-number';
import { isDateNotInPast, isValidBookingCalendarDate } from '@/lib/booking-date';

export const bookingInquirySchema = z
  .object({
    clientName: z
      .string()
      .trim()
      .min(2, 'Please enter your name (at least 2 characters).')
      .max(100, 'Name must be 100 characters or fewer.'),
    bandName: z
      .string()
      .trim()
      .max(100, 'Band or artist name must be 100 characters or fewer.')
      .optional(),
    contactNumber: z
      .string()
      .trim()
      .min(7, 'Please enter a valid WhatsApp or phone number.')
      .max(25, 'Contact number is too long.')
      .refine((value) => isValidPhoneNumber(value), {
        message: 'Please enter a valid WhatsApp or phone number (8–15 digits).',
      }),
    service: z.enum(['rehearsal', 'recording', 'mix-master'], {
      error: 'Please select a session type.',
    }),
    room: z.string().trim().optional(),
    preferredDate: z.string().trim().optional(),
    preferredTime: z.string().trim().optional(),
    duration: z.string().trim().optional(),
    targetDeadline: z.string().trim().optional(),
    notes: z.string().trim().max(600, 'Notes must be 600 characters or fewer.').optional(),
    privacyConsent: z.boolean().refine((val) => val === true, {
      message: 'Please agree to our Privacy Notice so the studio team can contact you.',
    }),
    website: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.service === 'mix-master') {
      const deadline = String(values.targetDeadline || '').trim();
      if (deadline) {
        if (!isValidBookingCalendarDate(deadline)) {
          ctx.addIssue({
            code: 'custom',
            path: ['targetDeadline'],
            message: 'Use a valid YYYY-MM-DD date for target deadline.',
          });
        } else if (!isDateNotInPast(deadline)) {
          ctx.addIssue({
            code: 'custom',
            path: ['targetDeadline'],
            message: 'Target deadline cannot be in the past.',
          });
        }
      }
      return;
    }

    if (!['room-a', 'room-b', 'any'].includes(String(values.room || ''))) {
      ctx.addIssue({
        code: 'custom',
        path: ['room'],
        message: 'Please choose a room preference.',
      });
    }

    const prefDate = String(values.preferredDate || '').trim();
    if (!prefDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['preferredDate'],
        message: 'Please select a preferred session date.',
      });
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(prefDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['preferredDate'],
        message: 'Use a valid YYYY-MM-DD calendar date.',
      });
    } else if (!isValidBookingCalendarDate(prefDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['preferredDate'],
        message: 'Please enter a valid calendar date.',
      });
    } else if (!isDateNotInPast(prefDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['preferredDate'],
        message: 'Preferred date cannot be in the past.',
      });
    }

    const startMinute = parseTimeStringToMinute(values.preferredTime);
    if (
      startMinute === null ||
      startMinute < OPERATING_START_MINUTE ||
      startMinute >= OPERATING_END_MINUTE ||
      startMinute % SLOT_INTERVAL_MINUTES !== 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['preferredTime'],
        message: 'Please select a valid 30-minute preferred start time.',
      });
    }

    const durationMinutes = parseDurationToMinutes(values.duration);
    if (
      durationMinutes === null ||
      durationMinutes < 60 ||
      durationMinutes > 780 ||
      durationMinutes % SLOT_INTERVAL_MINUTES !== 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration'],
        message: 'Please select a valid session duration.',
      });
    } else if (startMinute !== null && startMinute + durationMinutes > OPERATING_END_MINUTE) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration'],
        message: 'Selected duration exceeds studio closing time (23:00 WIB).',
      });
    }
  });

export const bookingInquiryResolver = zodResolver(bookingInquirySchema);
