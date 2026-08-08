import type { CampaignPlan, CampaignStatus } from "@motiongrid/domain";

export interface CampaignRecord {
  id: string;
  workspaceId: string;
  objective: string;
  status: CampaignStatus;
  plan?: CampaignPlan;
}

export interface CampaignRepository {
  create(input: Pick<CampaignRecord, "workspaceId" | "objective">): Promise<CampaignRecord>;
  find(id: string): Promise<CampaignRecord | null>;
  savePlan(id: string, plan: CampaignPlan): Promise<void>;
  setStatus(id: string, status: CampaignStatus): Promise<void>;
}

export interface ApprovalRepository {
  record(input: {
    campaignId: string;
    workspaceId: string;
    userId: string;
    scope: string[];
  }): Promise<{ id: string; approvedAt: Date }>;
  isValid(approvalId: string, campaignId: string, scope: string): Promise<boolean>;
}
