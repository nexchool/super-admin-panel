"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { PANEL_BASE } from "@/lib/api";
import {
  login as loginApi,
  logout as logoutApi,
  getSession,
  setPanelAuthCookie,
  clearPanelAuthCookie,
} from "@/lib/auth";
import type { LoginFormValues } from "@/lib/schemas";

export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const isLoginPage = pathname === "/login";

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: !isLoginPage,
  });

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) => loginApi(values),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Login failed");
    },
    onSuccess: async (data) => {
      const token = data?.data?.access_token;
      if (!token) {
        return;
      }
      await setPanelAuthCookie(token);
      queryClient.invalidateQueries({ queryKey: ["session"] });
      // Full page nav ensures cookie is sent and avoids RSC/prefetch issues
      window.location.href = `${PANEL_BASE}/dashboard`;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await logoutApi();
      await clearPanelAuthCookie();
    },
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
    },
  });

  return {
    session,
    isAuthenticated: !!session,
    isSessionLoading,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
