// src/lib/schemas/admin.schemas.ts
// Zod validation schemas for Kero Admin Dashboard forms and API mutations.
// Directly mirrors backend contracts in `KeroBackend/src/modules/admin/admin.schema.ts`.

import { z } from 'zod';
import { ALL_PERMISSIONS } from '@/types/admin';

// ─── Admin User CRUD ──────────────────────────────────────────────────

export const createAdminSchema = z.object({
  fullname: z.string().min(1, 'Full name is required'),
  email: z.string().email('A valid email address is required'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  roleId: z.string().min(1, 'A role must be selected'),
});

export const updateAdminSchema = z.object({
  fullname: z.string().min(1, 'Full name cannot be empty').optional(),
  email: z.string().email('A valid email address is required').optional(),
  roleId: z.string().min(1, 'A role must be selected').optional(),
  isSuperAdmin: z.boolean().optional(),
});

export const toggleAdminActiveSchema = z
  .object({
    isActive: z.boolean(),
    reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional(),
  })
  .refine(
    (data) => data.isActive || (data.reason !== undefined && data.reason.trim().length > 0),
    {
      message: 'A reason is required when deactivating an admin user',
      path: ['reason'],
    },
  );

export const deleteAdminSchema = z.object({
  reason: z.string().min(1, 'A reason is required for administrator account deletion'),
});

export const listAdminsQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  roleId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Role & Permissions CRUD ──────────────────────────────────────────

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100, 'Role name is too long'),
  description: z.string().max(500, 'Description cannot exceed 500 characters'),
  permissions: z
    .array(z.string())
    .min(1, 'At least one permission must be assigned to this role'),
  preset: z.string().optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1, 'Role name cannot be empty').max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).min(1, 'At least one permission is required').optional(),
  isActive: z.boolean().optional(),
});

export const togglePermissionsSchema = z
  .object({
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional(),
  })
  .refine(
    (data) =>
      (data.add !== undefined && data.add.length > 0) ||
      (data.remove !== undefined && data.remove.length > 0),
    {
      message: 'At least one permission to add or remove must be provided',
      path: ['add'],
    },
  );

export const deleteRoleSchema = z.object({
  reason: z.string().min(1, 'A reason is required to delete this role'),
});

// ─── Driver Management & Review Queue ─────────────────────────────────

export const suspendDriverSchema = z.object({
  reason: z.string().min(1, 'A reason is required for driver suspension'),
  durationHours: z.number().int().min(1, 'Duration must be at least 1 hour').optional(),
  type: z.enum(['hard', 'soft']),
});

export const unsuspendDriverSchema = z.object({
  reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional(),
});

export const bulkSuspendSchema = z.object({
  driverIds: z
    .array(z.string())
    .min(1, 'At least one driver ID must be selected')
    .max(50, 'Maximum 50 drivers can be suspended at once'),
  reason: z.string().min(1, 'A suspension reason is required'),
  type: z.enum(['hard', 'soft']),
});

export const unverifyDriverSchema = z.object({
  reason: z.string().min(1, 'A reason is required to unverify a driver account'),
});

export const driverStageReviewSchema = z
  .object({
    stage: z.enum(['personal', 'license', 'vehicle']),
    decision: z.enum(['approved', 'rejected']),
    rejectionReason: z.string().max(500).optional(),
  })
  .refine(
    (data) => data.decision !== 'rejected' || (data.rejectionReason && data.rejectionReason.trim().length > 0),
    {
      message: 'A rejection reason is required when rejecting a verification stage',
      path: ['rejectionReason'],
    },
  );

// ─── Trip Operations & Emergency ──────────────────────────────────────

export const dispatchTripSchema = z.object({
  riderId: z.string().min(1, 'Rider selection or ID is required'),
  pickupAddress: z.string().min(1, 'Pickup address is required'),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  destAddress: z.string().min(1, 'Destination address is required'),
  destLat: z.number().min(-90).max(90),
  destLng: z.number().min(-180).max(180),
  vehicleTypeId: z.string().min(1, 'Vehicle type must be selected'),
  paymentMethod: z.enum(['WALLET', 'CASH', 'CARD']),
  estimatedFareKobo: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export const assignDriverSchema = z.object({
  driverId: z.string().min(1, 'Driver ID is required for assignment'),
  reason: z.string().max(500).optional(),
});

export const forceCancelSchema = z.object({
  reason: z.string().min(1, 'A reason is required for force-cancelling a trip'),
  cancelBy: z.enum(['rider', 'driver', 'system']),
  waiveFee: z.boolean().default(false).optional(),
  refundRider: z.boolean().default(false).optional(),
});

export const deactivateSosSchema = z.object({
  resolution: z.enum(['resolved', 'false_alarm']),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
});

// ─── Pricing & Surge Management ───────────────────────────────────────

export const createPricingSchema = z.object({
  vehicleTypeId: z.string().min(1, 'Vehicle type selection is required'),
  baseFareKobo: z.number().int().min(0, 'Base fare must be non-negative'),
  pricePerKmKobo: z.number().int().min(0, 'Per-km rate must be non-negative'),
  pricePerMinuteKobo: z.number().int().min(0, 'Per-minute rate must be non-negative'),
  minimumFareKobo: z.number().int().min(0, 'Minimum fare must be non-negative'),
  keroCommissionRate: z.number().min(0).max(50, 'Kero commission can be at most 50%').default(18),
  cancellationFeeKobo: z.number().int().min(0).default(0),
  waitingChargePerMinuteKobo: z.number().int().min(0).default(0),
  lagosFeeType: z.enum(['FIXED', 'PERCENT']).default('FIXED'),
  lagosFlatCostPerTripKobo: z.number().int().min(0).default(5000),
  lagosPercentBps: z.number().int().min(0).max(5000).default(0),
  isActive: z.boolean().default(true),
});

export const updatePricingSchema = createPricingSchema.partial();

export const createSurgeSchema = z.object({
  vehicleTypeId: z.string().min(1, 'Vehicle type is required'),
  name: z.string().min(1, 'Zone or surge event name is required').max(100),
  currentMultiplier: z.number().min(1.0, 'Multiplier must be at least 1.0x').max(5.0, 'Multiplier cannot exceed 5.0x').default(1.5),
  maxMultiplier: z.number().min(1.0).max(5.0).default(3.0),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().optional(),
  autoDeactivateAt: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateSurgeSchema = createSurgeSchema.partial();

export const updateSurgeMultiplierSchema = z.object({
  multiplier: z.number().min(1.0).max(5.0),
});

// ─── Push Campaigns ───────────────────────────────────────────────────

export const createPushNotificationSchema = z.object({
  title: z.string().min(1, 'Campaign title is required').max(120),
  body: z.string().min(1, 'Notification body message is required').max(500),
  targetAudience: z.enum(['ALL', 'DRIVERS_ONLINE', 'DRIVERS_ALL', 'RIDERS_ACTIVE', 'RIDERS_ALL']),
  scheduledAt: z.string().optional(),
});

// ─── Inferred Types ───────────────────────────────────────────────────

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;
export type ToggleAdminActiveInput = z.infer<typeof toggleAdminActiveSchema>;
export type DeleteAdminInput = z.infer<typeof deleteAdminSchema>;
export type ListAdminsQuery = z.infer<typeof listAdminsQuerySchema>;

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type TogglePermissionsInput = z.infer<typeof togglePermissionsSchema>;
export type DeleteRoleInput = z.infer<typeof deleteRoleSchema>;

export type SuspendDriverInput = z.infer<typeof suspendDriverSchema>;
export type UnsuspendDriverInput = z.infer<typeof unsuspendDriverSchema>;
export type BulkSuspendInput = z.infer<typeof bulkSuspendSchema>;
export type UnverifyDriverInput = z.infer<typeof unverifyDriverSchema>;
export type DriverStageReviewInput = z.infer<typeof driverStageReviewSchema>;


export type DispatchTripInput = z.infer<typeof dispatchTripSchema>;
export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
export type ForceCancelInput = z.infer<typeof forceCancelSchema>;
export type DeactivateSosInput = z.infer<typeof deactivateSosSchema>;

export type CreatePricingInput = z.infer<typeof createPricingSchema>;
export type UpdatePricingInput = z.infer<typeof updatePricingSchema>;
export type CreateSurgeInput = z.infer<typeof createSurgeSchema>;
export type UpdateSurgeInput = z.infer<typeof updateSurgeSchema>;
export type UpdateSurgeMultiplierInput = z.infer<typeof updateSurgeMultiplierSchema>;
export type CreatePushNotificationInput = z.infer<typeof createPushNotificationSchema>;

// ─── Phase 3: Financials, Lagos Escrow & Settlement Schemas ───────────

export const createLagosAccountSchema = z.object({
  bankCode: z.string().min(1, 'Bank code is required'),
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().regex(/^\d{10}$/, 'Account number must be exactly 10 digits'),
  ministryDepartment: z.string().min(1, 'Government agency/ministry designation is required'),
});

export const verifyLagosAccountOtpSchema = z.object({
  otp: z.string().length(6, 'Verification code must be 6 digits'),
});

export const requestLagosWithdrawalSchema = z.object({
  amountKobo: z.number().int().min(100000, 'Minimum remittance withdrawal is ₦1,000'),
  settlementAccountId: z.string().min(1, 'Settlement account must be selected'),
  notes: z.string().max(500).optional(),
});

export const confirmLagosWithdrawalOtpSchema = z.object({
  otp: z.string().length(6, 'Confirmation OTP must be 6 digits'),
});

export const updateLagosSettingsSchema = z.object({
  flatCostPerTripKobo: z.number().int().min(0, 'Statutory flat rate must be non-negative'),
  ministryName: z.string().min(1, 'Ministry name is required'),
  regulatoryCode: z.string().min(1, 'Regulatory reference code is required'),
  autoRemitEnabled: z.boolean(),
  minRemittanceKobo: z.number().int().min(0),
});

export type CreateLagosAccountInput = z.infer<typeof createLagosAccountSchema>;
export type VerifyLagosAccountOtpInput = z.infer<typeof verifyLagosAccountOtpSchema>;
export type RequestLagosWithdrawalInput = z.infer<typeof requestLagosWithdrawalSchema>;
export type ConfirmLagosWithdrawalOtpInput = z.infer<typeof confirmLagosWithdrawalOtpSchema>;
export type UpdateLagosSettingsInput = z.infer<typeof updateLagosSettingsSchema>;

// ─── Phase 5: Fleet & Asset Management Schemas ─────────────────────────

export const createVehicleSchema = z.object({
  licensePlate: z.string().min(1, 'License plate is required').max(20),
  brand: z.string().max(50).optional(),
  model: z.string().min(1, 'Vehicle model is required').max(100),
  color: z.string().min(1, 'Vehicle color is required').max(50),
  year: z.number().int().min(2000).max(new Date().getFullYear() + 1),
  capacity: z.number().int().min(1).max(20).default(4),
  vehicleTypeId: z.string().min(1, 'Vehicle category is required'),
  isOwnerVehicle: z.boolean().default(false),
  fleetZoneId: z.string().optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export const vehicleStatusChangeSchema = z.object({
  status: z.enum(['maintenance', 'available', 'decommissioned']),
  reason: z.string().min(1, 'A reason is required for status change').max(500),
  nextInspectionDue: z.string().optional(),
});

export const assignVehicleSchema = z.object({
  driverId: z.string().min(1, 'Driver must be selected'),
  vehicleId: z.string().min(1, 'Vehicle ID is required'),
  reason: z.string().max(500).optional(),
});

export const unassignVehicleSchema = z.object({
  driverId: z.string().min(1, 'Driver ID is required'),
  vehicleId: z.string().min(1, 'Vehicle ID is required'),
  reason: z.string().min(1, 'A reason is required to unassign vehicle').max(500),
});

export const createFleetZoneSchema = z.object({
  name: z.string().min(1, 'Zone or depot name is required').max(100),
  description: z.string().min(1, 'Zone description is required').max(1000),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type VehicleStatusChangeInput = z.infer<typeof vehicleStatusChangeSchema>;
export type AssignVehicleInput = z.infer<typeof assignVehicleSchema>;
export type UnassignVehicleInput = z.infer<typeof unassignVehicleSchema>;
export type CreateFleetZoneInput = z.infer<typeof createFleetZoneSchema>;

// ─── Phase 6: Growth, Marketing & Passenger Engagement Schemas ─────────

export const createPushCampaignSchema = z.object({
  title: z.string().min(1, 'Campaign title is required').max(120),
  body: z.string().min(1, 'Notification body message is required').max(500),
  targetAudience: z.enum(['all', 'riders', 'drivers']),
  scheduledAt: z.string().optional(),
});

export const updatePushCampaignSchema = createPushCampaignSchema.partial();

export const createBannerSchema = z.object({
  title: z.string().min(1, 'Banner title is required').max(200),
  subtitle: z.string().max(300).optional(),
  imageUrl: z.string().min(1, 'Image URL or CDN asset path is required'),
  linkUrl: z.string().optional(),
  targetAudience: z.enum(['all', 'riders', 'drivers']),
  priority: z.number().int().min(0).max(1000).default(0),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateBannerSchema = createBannerSchema.partial();

export const updateReferralConfigSchema = z.object({
  isActive: z.boolean(),
  referrerRewardValueKobo: z.number().int().min(0),
  referredRewardValueKobo: z.number().int().min(0),
  minTripsForUnlock: z.number().int().min(0),
  unlockWindowDays: z.number().int().min(0),
  requireUniqueDevice: z.boolean(),
  requireUniqueBankAccount: z.boolean(),
});

export const updateDispatchConfigSchema = z.object({
  etaWeight: z.number().min(0).max(1),
  driverRatingWeight: z.number().min(0).max(1),
  completionRateWeight: z.number().min(0).max(1),
  socketOnlineWeight: z.number().min(0).max(1),
  acceptanceRateWeight: z.number().min(0).max(1),
  searchRadiusInitialKm: z.number().min(1).max(20),
  searchRadiusStepKm: z.number().min(1).max(10),
  searchRadiusMaxKm: z.number().min(5).max(50),
  offerTimeoutSeconds: z.number().int().min(10).max(90),
  batchDispatchSize: z.number().int().min(1).max(10),
});

export const updateCashPolicySchema = z.object({
  softSuspensionThresholdKobo: z.number().int().min(0),
  hardSuspensionThresholdKobo: z.number().int().min(0),
  gracePeriodDays: z.number().int().min(1).max(30),
  autoDeductFromWallet: z.boolean().default(true),
  primaryGateway: z.enum(['paystack', 'flutterwave', 'monnify']),
  secondaryGateway: z.enum(['paystack', 'flutterwave', 'monnify']),
  tertiaryGateway: z.enum(['paystack', 'flutterwave', 'monnify']),
  enableFallbackFailover: z.boolean().default(true),
});

export const updateAntiFraudSchema = z.object({
  requireUniqueDevice: z.boolean().default(true),
  maxAccountsPerDevice: z.number().int().min(1).max(5),
  blockEmulatorSessions: z.boolean().default(true),
  blockMockLocations: z.boolean().default(true),
  sameIpRateLimitPerHour: z.number().int().min(5).max(500),
  suspiciousCancellationThreshold: z.number().int().min(3).max(20),
});

export const auditExportSchema = z.object({
  format: z.enum(['csv', 'json']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  category: z.string().optional(),
});

export const createEmployeeSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone is required'),
  department: z.enum(['Operations', 'Finance', 'Customer Support', 'Engineering', 'Executive']),
  position: z.string().min(2, 'Position title is required'),
  salaryKobo: z.number().int().min(0, 'Salary must be positive'),
  employmentType: z.enum(['Full-Time', 'Contract', 'Probation']),
});

export const createExpenseClaimSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  category: z.enum(['Fuel & Logistics', 'Office Supplies', 'Client Entertainment', 'Emergency Fleet Op', 'Other']),
  amountKobo: z.number().int().min(100, 'Amount must be at least ₦1'),
  receiptReference: z.string().min(3, 'Receipt ref is required'),
  justification: z.string().min(5, 'Justification is required'),
});

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  leaveType: z.enum(['Annual', 'Sick', 'Maternity/Paternity', 'Compassionate']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  notes: z.string().optional(),
});

export type CreatePushCampaignInput = z.infer<typeof createPushCampaignSchema>;
export type UpdatePushCampaignInput = z.infer<typeof updatePushCampaignSchema>;
export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;
export type UpdateReferralConfigInput = z.infer<typeof updateReferralConfigSchema>;
export type UpdateDispatchConfigInput = z.infer<typeof updateDispatchConfigSchema>;
export type UpdateCashPolicyInput = z.infer<typeof updateCashPolicySchema>;
export type UpdateAntiFraudInput = z.infer<typeof updateAntiFraudSchema>;
export type AuditExportInput = z.infer<typeof auditExportSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type CreateExpenseClaimInput = z.infer<typeof createExpenseClaimSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;



