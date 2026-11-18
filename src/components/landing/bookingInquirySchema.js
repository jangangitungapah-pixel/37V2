import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { isDateNotInPast, isValidBookingCalendarDate } from '@/lib/booking-date';

export const bookingInquirySchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(2, 'Please enter your name or band name (at least 2 characters).')
    .max(80, 'Name must be 80 characters or fewer.'),
  contactNumber: z
    .string()
    .trim()
    .min(7, 'Please enter a valid WhatsApp or phone number.')
    .max(25, 'Contact number is too long.')
    .regex(/^[0-9+()\-\s]+$/, 'Use digits, spaces, or + / - only.'),
  service: z.enum(['rehearsal', 'recording', 'mix-master'], {
    error: 'Please select a session type.',
  }),
  room: z.enum(['room-a', 'room-b', 'any'], {
    error: 'Please choose a room preference.',
  }),
  preferredDate: z
    .string()
    .trim()
    .min(1, 'Please select a preferred session date.')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid YYYY-MM-DD calendar date.')
    .refine((value) => isValidBookingCalendarDate(value), {
      message: 'Please enter a valid calendar date.',
    })
    .refine((value) => isDateNotInPast(value), {
      message: 'Preferred date cannot be in the past.',
    }),
  preferredTime: z.string().trim().min(1, 'Please select a preferred start time.'),
  duration: z.string().trim().min(1, 'Please select an estimated session duration.'),
  notes: z.string().trim().max(400, 'Notes must be 400 characters or fewer.').optional(),
});

export const bookingInquiryResolver = zodResolver(bookingInquirySchema);
