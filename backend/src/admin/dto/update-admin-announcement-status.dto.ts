import { IsIn, IsString } from 'class-validator';

const STATUSES = ['ACTIVE', 'HIDDEN', 'UNAVAILABLE', 'EXPIRED'] as const;

export class UpdateAdminAnnouncementStatusDto {
  @IsString()
  @IsIn([...STATUSES])
  status!: (typeof STATUSES)[number];
}
