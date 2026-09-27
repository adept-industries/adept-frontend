export interface TeamMember {
  membershipId: string;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  role: "MANAGER" | "LEAD";
}

export interface ProjectTeam {
  projectId: string;
  projectName: string;
  projectDescription?: string | null;
  manager?: TeamMember | null;
  members: TeamMember[];
}

export interface ChatMessage {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
  sender: TeamMember;
}
