// src/types/admin.ts
// Typed contracts matching KeroBackend admin & RBAC architecture

export const ALL_PERMISSIONS = [
  // Dashboard
  'view_dashboard',
  'view_live_watch',

  // Drivers
  'view_drivers',
  'verify_driver',
  'unverify_driver',
  'verify_driver_nin',
  'verify_driver_license',
  'verify_driver_plate',
  'suspend_driver',
  'unsuspend_driver',
  'delete_driver',
  'review_driver_stage',
  'final_approve_driver',

  // Riders
  'view_riders',
  'suspend_rider',
  'unsuspend_rider',
  'delete_rider',

  // Trips
  'view_trips',
  'view_trip_detail',
  'force_cancel_trip',

  // Transactions
  'view_transactions',
  'view_kero_commission',
  'view_lagos_commission',
  'export_transactions',

  // Pricing
  'view_pricing',
  'create_pricing',
  'edit_pricing',
  'delete_pricing',
  'toggle_pricing',

  // Surge
  'view_surge',
  'create_surge',
  'edit_surge',
  'delete_surge',
  'activate_surge',
  'deactivate_surge',
  'update_surge_multiplier',

  // Push Notifications
  'view_push_notifications',
  'create_push_notification',
  'edit_push_notification',
  'delete_push_notification',
  'pause_push_notification',

  // Rewards
  'view_rewards',
  'create_reward',
  'edit_reward',
  'delete_reward',
  'view_reward_logs',

  // SOS / Emergency
  'view_sos',
  'deactivate_sos',

  // Help Center / Support
  'view_support',
  'respond_support',
  'assign_support',

  // Admin Users
  'view_admin_users',
  'create_admin_user',
  'edit_admin_user',
  'delete_admin_user',
  'change_admin_password',
  'suspend_admin_user',

  // Roles & Permissions
  'view_roles',
  'create_role',
  'edit_role',
  'delete_role',

  // Vehicle Types
  'view_vehicle_types',
  'create_vehicle_type',
  'edit_vehicle_type',
  'delete_vehicle_type',

  // Banners
  'view_banners',
  'create_banner',
  'edit_banner',
  'delete_banner',
  'toggle_banner',

  // Lagos Commission
  'lagos_view_wallet',
  'lagos_view_settlement_account',
  'lagos_manage_settlement_account',
  'lagos_request_withdrawal',
  'lagos_view_withdrawals',
  'lagos_view_settings',
  'lagos_manage_settings',
  'lagos_view_activity_log',

  // Fleet & System Config
  'view_fleet',
  'manage_fleet',
  'view_dispatch_config',
  'manage_dispatch_config',
  'view_cash_config',
  'manage_cash_config',
  'view_referral_config',
  'manage_referral_config',

  // HR / Staff (26)
  'hr_view_dashboard',
  'hr_view_employees',
  'hr_create_employee',
  'hr_edit_employee',
  'hr_delete_employee',
  'hr_view_departments',
  'hr_create_department',
  'hr_edit_department',
  'hr_delete_department',
  'hr_view_requests',
  'hr_approve_leave',
  'hr_approve_expense',
  'hr_approve_funds',
  'hr_approve_id_card',
  'hr_approve_performance_review',
  'hr_manage_delegation',
  'hr_manage_approval_config',
  'hr_manage_assets',
  'hr_view_audit_log',
  'hr_manage_leave_balance',
  'hr_manage_reimbursement',
  'hr_view_budget_summary',
  'hr_manage_id_cards',
  'hr_manage_goals',
  'hr_view_performance',
  'hr_manage_appraisals',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export interface AdminUser {
  id: string;
  fullname: string;
  email: string;
  phone?: string | null;
  isSuperAdmin: boolean;
  roleLabel: string;
  roleId?: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  permissions: Permission[];
}

export interface AdminRoleItem {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  permissionCount: number;
  isActive: boolean;
  adminCount: number;
  createdAt: string;
}

export interface PermissionGroup {
  domain: string;
  label: string;
  permissions: {
    key: Permission;
    label: string;
    description: string;
  }[];
}

export interface DashboardOverview {
  totalDrivers: number;
  activeDrivers: number;
  totalRiders: number;
  activeRidersToday: number;
  totalTrips: number;
  activeTrips: number;
  completedTripsToday: number;
}

export interface DashboardRevenue {
  today: number; // kobo
  thisWeek: number; // kobo
  lastWeek: number; // kobo
  weekChangePercent: number;
}

export interface DashboardTrips {
  today: number;
  thisWeek: number;
  avgFareToday: number; // kobo
  cancelRateToday: number;
}

export interface DashboardDrivers {
  online: number;
  onTrip: number;
  pendingKYC: number;
  suspended: number;
}

export interface DashboardResponse {
  overview: DashboardOverview;
  revenue: DashboardRevenue;
  trips: DashboardTrips;
  drivers: DashboardDrivers;
}

export interface LiveTrip {
  tripId: string;
  status: string;
  rider: { id: string; name: string; phone: string | null; avatarUrl?: string | null; profileImage?: string | null };
  driver: { id: string; name: string; phone: string | null; avatarUrl?: string | null; selfieUrl?: string | null } | null;
  vehicle: { licensePlate: string; model: string; color: string } | null;
  pickup: { lat: number; lng: number; address: string };
  destination: { lat: number; lng: number; address: string };
  currentLocation: { lat: number; lng: number; heading: number; updatedAt: string } | null;
  fare: number | null; // kobo
  startedAt: string | null;
}

export interface OnlineDriver {
  driverId: string;
  firstname: string | null;
  lastname: string | null;
  phone: string | null;
  status: string;
  rating: number;
  avatarUrl?: string | null;
  selfieUrl?: string | null;
  vehicle: { licensePlate: string; model: string; color: string; type: string | null } | null;
  location: { lat: number; lng: number; heading: number; updatedAt: string } | null;
}

export interface SosAlertItem {
  id: string;
  tripId: string;
  triggeredBy: 'rider' | 'driver';
  driverId: string;
  riderId: string;
  lat: number;
  lng: number;
  status: 'ACTIVE' | 'RESOLVED';
  claimedBy?: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: 'kyc' | 'sos' | 'wallet' | 'trip' | 'system';
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

// ─── Phase 1: Driver & KYC Types ─────────────────────────────────────
export interface AdminDriverListItem {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string;
  phone: string | null;
  status: string;
  /** Email verified at sign-up. This is NOT KYC — see kycStatus. */
  isVerified: boolean;
  emailVerified?: boolean;
  kycVerified?: boolean;
  kycSubmitted?: boolean;
  kycStatus?: import('@/components/drivers/verification-pills').DriverKycStatus;
  isSuspended: boolean;
  rating: number;
  ratingCount: number;
  tier: string;
  totalTrips: number;
  createdAt: string;
  lastActivityAt: string | null;
  vehicle: {
    id: string;
    licensePlate: string;
    model: string;
    vehicleType: { id: string; name: string } | null;
  } | null;
  avatarUrl?: string | null;
  selfieUrl?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
}

export interface ReviewQueueItem {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string;
  phone: string | null;
  kycSubmittedAt: string | null;
  stages: Array<{ stage: 'personal' | 'license' | 'vehicle'; status: 'empty' | 'submitted' | 'approved' | 'rejected' }>;
}

export interface AdminDriverDetail extends AdminDriverListItem {
  suspendedAt: string | null;
  suspendedReason: string | null;
  totalRating: number;
  ratingSuspensionStatus: string;
  bronzeSince: string | null;
  walletBalance: number;
  bonusBalance: number;
  outstandingFees: number;
  isSoftSuspended: boolean;
  isHardSuspended: boolean;
  updatedAt: string;
  kycSubmitted: boolean;
  kycSubmittedAt: string | null;
  kycVerified: boolean;
  kycRejectionReason?: string | null;
  emailVerifiedAt?: string | null;
  kyc?: import('@/components/drivers/driver-kyc-panel').DriverKycSummary;
  onboardingState: {
    personal?: {
      nin?: string;
      ninVerified?: boolean;
      ninVerifiedAt?: string;
      dob?: string;
      address?: string;
      avatarUrl?: string;
      ninDocumentUrl?: string;
    };
    license?: {
      licenseNumber?: string;
      licenseExpiry?: string;
      licenseVerified?: boolean;
      frontImageUrl?: string;
      backImageUrl?: string;
    };
    vehicle?: {
      licensePlate?: string;
      make?: string;
      model?: string;
      year?: number;
      color?: string;
      inspectionDocUrl?: string;
      insuranceDocUrl?: string;
      interiorPhotoUrl?: string;
      exteriorPhotoUrl?: string;
    };
    stages?: Record<string, { status: string; decision?: string; reason?: string }>;
  } | null;
  vehicle: {
    id: string;
    licensePlate: string;
    model: string;
    color: string;
    year: number;
    vehicleType: { id: string; name: string } | null;
  } | null;
  recentTrips: Array<{
    id: string;
    status: string;
    fareKobo: number | null;
    createdAt: string;
    endTime: string | null;
  }>;
  recentActions: Array<{
    id: string;
    action: string;
    result: string;
    createdAt: string;
  }>;
}

// ─── Phase 1: Rider Types ────────────────────────────────────────────
export interface AdminRiderListItem {
  id: string;
  fullname: string | null;
  email: string | null;
  phone: string | null;
  isVerified: boolean;
  isSuspended: boolean;
  cashPaymentBlocked: boolean;
  walletBalance: number;
  bonusBalance: number;
  riderRating: number;
  riderRatingCount: number;
  totalTrips: number;
  createdAt: string;
  avatarUrl?: string | null;
  profileImage?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
}

export interface AdminRiderDetail extends AdminRiderListItem {
  recentTrips?: Array<{
    id: string;
    status: string;
    fareKobo: number | null;
    pickupAddress: string;
    destAddress: string;
    createdAt: string;
  }>;
}

// ─── Phase 2: Trip & SOS Types ────────────────────────────────────────
export interface AdminTripListItem {
  id: string;
  status: string;
  paymentMethod: string;
  isCashTrip: boolean;
  fareKobo: number | null;
  grandTotalKobo: number | null;
  estimatedFareKobo?: number | null;
  cancellationFeeKobo: number | null;
  distanceKm: number;
  createdAt: string;
  endTime: string | null;
  cancelledAt: string | null;
  startAddress: string;
  endAddress: string;
  rider: {
    id: string;
    fullname: string | null;
    phone: string | null;
    avatarUrl?: string | null;
    profileImage?: string | null;
  } | null;
  driver: {
    id: string;
    firstname: string | null;
    lastname: string | null;
    phone: string | null;
    avatarUrl?: string | null;
    selfieUrl?: string | null;
  } | null;
  vehicle: {
    licensePlate: string;
    model: string;
    color: string;
  } | null;
  sosAlertCount: number;
}

export interface AdminTripDetail {
  id: string;
  title: string;
  riderId: string;
  driverId: string | null;
  status: string;
  startAddress: string;
  endAddress: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  paymentMethod: string;
  isCashTrip: boolean;
  estimatedFareKobo: number | null;
  fareKobo: number | null;
  driverDiscountKobo: number;
  grandTotalKobo: number | null;
  cancellationFeeKobo: number | null;
  distanceKm: number;
  durationMinutes: number | null;
  polyline: string | null;
  createdAt: string;
  acceptedAt: string | null;
  startTime: string | null;
  endTime: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  rider: {
    id: string;
    fullname: string | null;
    phone?: string | null;
    rating: number;
  };
  driver: {
    id: string;
    firstname: string | null;
    lastname: string | null;
    phone: string | null;
    rating: number;
    vehicle?: {
      licensePlate: string;
      model: string;
      color: string;
    } | null;
  } | null;
  rating: {
    driverRating: number | null;
    driverComment: string | null;
    driverTags?: string[];
    driverRatedAt?: string | null;
  } | null;
  stops?: Array<{
    id: string;
    address: string;
    lat: number;
    lng: number;
    order: number;
  }>;
  dispatchOffers?: Array<{
    driverId: string;
    status: string;
    createdAt: string;
  }>;
  surgeMultiplier: number | null;
  baseFareKobo: number | null;
  distanceFareKobo: number | null;
  timeFareKobo: number | null;
  subtotalKobo: number | null;
  surgeFareKobo: number | null;
  waitTimeFeeKobo: number | null;
  keroCommissionKobo: number | null;
  lagosCommissionKobo: number | null;
  driverEarningsKobo: number | null;
  actualCashCollectedKobo: number | null;
  isTrackingActive?: boolean;
}

export interface DetailedSosAlertItem {
  id: string;
  tripId: string;
  riderId: string | null;
  driverId: string | null;
  triggeredBy: 'rider' | 'driver' | string;
  location: { lat: number; lng: number };
  message: string | null;
  status: 'ACTIVE' | 'RESOLVED' | string;
  claimedBy?: string | null;
  claimedByName?: string | null;
  responderId?: string | null;
  acknowledgedAt?: string | null;
  ticketId?: string | null;
  ticketNumber?: string | null;
  unreadByAdmin?: number;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  trip?: {
    id: string;
    startAddress: string;
    endAddress: string;
    status: string;
    rider?: { id?: string; fullname: string | null; phone: string | null; profileImage?: string | null; avatarUrl?: string | null };
    driver?: { id?: string; firstname: string | null; lastname: string | null; phone: string | null; selfieUrl?: string | null; avatarUrl?: string | null };
    vehicle?: { licensePlate: string; model: string; color: string };
  };
}

// ─── Phase 3: Finance, Lagos Escrow & Settlement Types ─────────────────
export interface AdminTransactionItem {
  id: string;
  userId: string;
  userType: 'RIDER' | 'DRIVER' | 'SYSTEM' | string;
  userName?: string | null;
  userEmail?: string | null;
  type: 'TRIP_PAYMENT' | 'WALLET_TOPUP' | 'WITHDRAWAL' | 'REFUND' | 'COMMISSION' | 'DISPUTE_ADJUSTMENT' | string;
  amountKobo: number;
  feeKobo: number;
  balanceBeforeKobo: number;
  balanceAfterKobo: number;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | string;
  paymentMethod: 'WALLET' | 'CASH' | 'CARD' | 'PAYSTACK' | 'FLUTTERWAVE' | 'MONNIFY' | string;
  reference: string;
  description: string;
  tripId?: string | null;
  createdAt: string;
}

export interface LagosWalletResponse {
  balanceKobo: number;
  totalCollectedKobo: number;
  pendingWithdrawalsKobo: number;
  activeAccountsCount: number;
  lastRemittanceAt: string | null;
}

export interface LagosSettlementAccount {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  ministryDepartment: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface LagosWithdrawalItem {
  id: string;
  amountKobo: number;
  status: 'PENDING_OTP' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  settlementAccount: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  requestedBy: {
    fullname: string;
    email: string;
  };
  reference: string;
  createdAt: string;
  completedAt: string | null;
}

export interface LagosSettings {
  flatCostPerTripKobo: number;
  ministryName: string;
  regulatoryCode: string;
  autoRemitEnabled: boolean;
  minRemittanceKobo: number;
  updatedAt: string;
}

export interface LagosActivityLogItem {
  id: string;
  action: string;
  actorEmail: string;
  ipAddress: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface LagosTransactionItem {
  id: string;
  type: 'TRIP_COMMISSION' | 'WITHDRAWAL' | 'ADJUSTMENT' | string;
  amountKobo: number;
  balanceAfterKobo: number;
  tripId?: string | null;
  withdrawalId?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface CashDisputeItem {
  id: string;
  tripId: string;
  driverId: string;
  driverName: string;
  riderId: string;
  riderName: string;
  fareKobo: number;
  disputedAmountKobo: number;
  reason: string;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
}

export interface GatewayHealthItem {
  gateway: 'PAYSTACK' | 'FLUTTERWAVE' | 'MONNIFY' | string;
  enabled: boolean;
  priority: number;
  isHealthy: boolean;
  successRate: number;
  minAmountKobo: number;
  maxAmountKobo: number;
  timeoutMs: number;
}

export interface DriverDisbursementItem {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone?: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amountKobo: number;
  gateway: 'PAYSTACK' | 'FLUTTERWAVE' | 'MONNIFY' | string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  reference: string;
  failureReason?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface OutstandingDriverItem {
  driverId: string;
  name: string;
  phone: string | null;
  email: string | null;
  outstandingFeesKobo: number;
  walletBalanceKobo: number;
  totalTrips: number;
  lastTripAt: string | null;
}

// ─── Phase 4: Tariffs, Pricing & Surge Geofencing Types ───────────────
export interface PricingDto {
  id: string;
  vehicleTypeId: string;
  vehicleTypeName: string;
  baseFareKobo: number;
  pricePerKmKobo: number;
  pricePerMinuteKobo: number;
  minimumFareKobo: number;
  waitingChargePerMinuteKobo: number;
  cancellationFeeKobo: number;
  keroCommissionRate: number;
  lagosFlatCostPerTripKobo: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SurgeDto {
  id: string;
  name: string | null;
  pricingId: string | null;
  vehicleTypeId: string;
  vehicleTypeName: string;
  currentMultiplier: number;
  maxMultiplier: number;
  isActive: boolean;
  reason: string | null;
  expiresAt: string | null;
  autoDeactivateAt: string | null;
  conditions?: Record<string, any> | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
  activatedBy: string | null;
  createdAt: string;
}

export interface VehicleTypePricingItem {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  capacity: number;
  pricing?: PricingDto | null;
}

// ─── Phase 5: Fleet & Asset Management Types ─────────────────────────
export interface FleetVehicleItem {
  id: string;
  licensePlate: string;
  brand: string | null;
  model: string;
  color: string;
  year: number;
  capacity: number | null;
  vehicleType: { id: string; name: string } | null;
  fleetZone: { id: string; name: string } | null;
  driver: { id: string; firstname: string | null; lastname: string | null; phone?: string | null } | null;
  isOwnerVehicle: boolean;
  status: 'available' | 'assigned' | 'maintenance' | 'decommissioned' | string;
  nextInspectionDue: string | null;
  lastInspectionAt?: string | null;
  createdAt: string;
}

export interface FleetVehicleListResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  vehicles: FleetVehicleItem[];
}

export interface FleetZoneItem {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  vehicleCount: number;
  driverCount: number;
  createdAt: string;
}

export interface FleetHealthAlert {
  type: 'inspection_overdue' | 'long_maintenance' | 'driver_without_vehicle' | 'vehicle_without_driver';
  vehicleId?: string;
  driverId?: string;
  message: string;
}

export interface FleetHealthResponse {
  summary: {
    totalVehicles: number;
    activeVehicles: number;
    maintenanceVehicles: number;
    decommissionedVehicles: number;
    unassignedVehicles: number;
    totalDrivers: number;
    driversWithVehicle: number;
    driversWithoutVehicle: number;
  };
  zones: Array<{ id: string; name: string; vehicleCount: number; activeVehicleCount: number }>;
  vehicleTypes: Array<{ id: string; name: string; vehicleCount: number }>;
  alerts: FleetHealthAlert[];
}

// ─── Phase 6: Growth, Marketing & Push Campaigns Types ───────────────
export interface PushCampaignItem {
  id: string;
  title: string;
  body: string;
  targetAudience: 'ALL' | 'DRIVERS_ONLINE' | 'DRIVERS_ALL' | 'RIDERS_ACTIVE' | 'RIDERS_ALL' | string;
  status: 'PENDING' | 'SCHEDULED' | 'SENT' | 'PAUSED' | 'FAILED' | string;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  deliveredCount: number;
  openedCount: number;
  createdBy?: string | null;
  createdAt: string;
}

export interface BannerItem {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  targetAudience: 'all' | 'riders' | 'drivers' | string;
  isActive: boolean;
  priority: number;
  startsAt: string;
  endsAt: string | null;
  impressions: number;
  clicks: number;
  createdAt: string;
}

export interface ReferralConfigDto {
  id: string;
  role: 'rider' | 'driver' | string;
  referrerRewardType: 'FLAT' | 'PERCENTAGE' | 'NONE';
  referrerRewardValueKobo: number;
  referredRewardType: 'FLAT' | 'PERCENTAGE' | 'NONE';
  referredRewardValueKobo: number;
  minTripsForUnlock: number;
  unlockWindowDays: number;
  maxReferralsPerUser: number;
  maxTotalRewardKobo: number;
  requireUniqueDevice: boolean;
  requireUniqueBankAccount: boolean;
  maxSameDeviceReferrals: number;
  maxSameIPReferrals: number;
  minDaysBetweenReferrals: number;
  isActive: boolean;
  updatedAt: string;
}

// ─── Service Areas & Operating Corridors ──────────────────────────────
export type ServiceAreaStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type ServiceAreaDestinationPolicy =
  | 'INSIDE_ONLY'
  | 'OUTBOUND_ALLOWED'
  | 'ANY_ACTIVE_SERVICE_AREA';

export interface ServiceAreaGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: any;
}

export interface ServiceAreaItem {
  id: string;
  name: string;
  description?: string | null;
  geometry: ServiceAreaGeometry;
  status: ServiceAreaStatus;
  destinationPolicy: ServiceAreaDestinationPolicy;
  allowedVehicleTypes: string[];
  priority: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Financial Intelligence & Master Ledger ───────────────────────────
export interface FinanceOverviewMetrics {
  grossRideVolumeKobo: number;
  platformCommissionKobo: number;
  driverEarningsKobo: number;
  completedTripsCount: number;
  riderWalletHoldingsKobo: number;
  driverWalletHoldingsKobo: number;
  driverOutstandingDebtKobo: number;
  lagosWalletBalanceKobo: number;
  lagosTotalCollectedKobo: number;
  totalFloatHoldingsKobo: number;
}

export interface FinancePeriodSummary {
  grossFareKobo: number;
  commissionKobo: number;
  completedTrips: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  volumeKobo: number;
}

export interface DailyRevenueChartPoint {
  date: string;
  grossKobo: number;
  platformKobo: number;
  driverKobo: number;
  lagosKobo: number;
  tripCount: number;
}

export interface FinanceOverviewData {
  metrics: FinanceOverviewMetrics;
  today: FinancePeriodSummary;
  thisWeek: FinancePeriodSummary;
  thisMonth: FinancePeriodSummary;
  allTime: FinancePeriodSummary;
  paymentMethodSplit: PaymentMethodBreakdown[];
  dailyRevenueChart: DailyRevenueChartPoint[];
  cashflow: {
    inflowKobo: number;
    outflowKobo: number;
    netRetentionKobo: number;
  };
}

export interface FinanceTransactionUser {
  id: string;
  fullname: string | null;
  email: string | null;
  phone: string | null;
}

export interface FinanceTransactionDriver {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string;
  phone: string | null;
}

export interface FinanceTransactionItem {
  id: string;
  transactionId: string;
  reference: string;
  amountKobo: number;
  chargesKobo: number;
  keroCommissionKobo: number;
  lagosCommissionKobo: number;
  settledAmountKobo: number;
  transactionType: string;
  transactionServices: string;
  gateway: string;
  status: string;
  accountNumber?: string | null;
  accountName?: string | null;
  bankName?: string | null;
  narration?: string | null;
  createdAt: string;
  user?: FinanceTransactionUser | null;
  driver?: FinanceTransactionDriver | null;
}

export interface FinanceTransactionsResponse {
  data: FinanceTransactionItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Help Center & Support Ticketing ──────────────────────────────────
export type SupportTicketCategory =
  | 'sos_emergency'
  | 'trip_issue'
  | 'fare_dispute'
  | 'lost_item'
  | 'safety_report'
  | 'payment_wallet'
  | 'account_kyc'
  | 'general';

export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'critical_sos';

export type SupportTicketStatus =
  | 'open'
  | 'acknowledged'
  | 'in_progress'
  | 'waiting_on_user'
  | 'resolved'
  | 'closed';

export interface SupportMessageItem {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: 'rider' | 'driver' | 'admin' | 'system';
  senderName: string;
  messageType: 'text' | 'image' | 'location' | 'system_event';
  text: string | null;
  mediaUrl: string | null;
  metadata: Record<string, unknown> | null;
  /** When the other side saw it (null = not yet). */
  readAt?: string | null;
  createdAt: string;
}

export interface SupportTicketItem {
  id: string;
  ticketNumber: string;
  reporterRole: 'rider' | 'driver';
  reporterId: string;
  userId: string | null;
  driverId: string | null;
  tripId: string | null;
  sosAlertId: string | null;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  subject: string;
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolvedByAdminId: string | null;
  resolutionNotes: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadByUser: number;
  unreadByAdmin: number;
  createdAt: string;
  updatedAt: string;
  reporter?: {
    id: string;
    role: 'rider' | 'driver';
    name: string;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  trip?: {
    id: string;
    status: string;
    startAddress: string;
    endAddress: string;
    createdAt: string;
  } | null;
  sosAlert?: {
    id: string;
    status: string;
    triggeredBy: string;
    latitude: number;
    longitude: number;
    message: string | null;
    claimedByAdminId: string | null;
    claimedByName: string | null;
    acknowledgedAt: string | null;
    createdAt: string;
  } | null;
}

export interface SupportTicketListResponse {
  tickets: SupportTicketItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

