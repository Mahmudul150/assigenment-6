import type { InvitationStatus } from "../../../../generated/prisma/enums";

export interface ICreateInvitation {
	assessmentId: string;
	email: string;
}

export interface IUpdateInvitation {
	status: InvitationStatus;
}
