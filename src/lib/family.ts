import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FamilyMember = { user_id: string; name: string; joined_at: string };
export type FamilyInvite = { token: string; expires_at: string };
export type FamilyOverview = {
  family: { id: string; name: string } | null;
  members: FamilyMember[];
  invites: FamilyInvite[];
};

export function useFamilyOverview() {
  return useQuery({
    queryKey: ["family"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("family_overview");
      if (error) throw error;
      return data as unknown as FamilyOverview;
    },
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_family_invite");
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["family"] }),
  });
}

export function inviteLink(token: string) {
  return `${window.location.origin}/convite?token=${token}`;
}
