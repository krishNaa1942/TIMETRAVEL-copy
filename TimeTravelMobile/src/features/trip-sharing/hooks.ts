import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import sharingService, { SharedTrip } from "@/services/sharing";
import tripPlannerService, { TripData } from "@/services/tripPlanner";

const TRIP_SHARING_ROOT_KEY = ["trip-sharing"] as const;

export const tripSharingKeys = {
  root: TRIP_SHARING_ROOT_KEY,
  trips: () => [...TRIP_SHARING_ROOT_KEY, "trips"] as const,
  shares: () => [...TRIP_SHARING_ROOT_KEY, "shares"] as const,
};

const DEFAULT_STALE_TIME = 2 * 60 * 1000;
const DEFAULT_GC_TIME = 10 * 60 * 1000;

const parseTimestamp = (value?: string): number => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortTripsByRecency = (trips: TripData[]): TripData[] =>
  [...trips].sort(
    (left, right) =>
      parseTimestamp(right.updated_at ?? right.created_at) -
      parseTimestamp(left.updated_at ?? left.created_at),
  );

const sortSharesByRecency = (shares: SharedTrip[]): SharedTrip[] =>
  [...shares].sort(
    (left, right) =>
      parseTimestamp(right.created_at) - parseTimestamp(left.created_at),
  );

export const getTripSharingErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
};

export interface CreateShareInput {
  tripId: number;
  tripTitle: string;
  notes?: string;
  itineraryJson?: Record<string, unknown>;
}

interface ShareMutationContext {
  previousShares?: SharedTrip[];
  optimisticShareId: number;
}

export const useTrips = () =>
  useQuery({
    queryKey: tripSharingKeys.trips(),
    queryFn: async (): Promise<TripData[]> => {
      const response = await tripPlannerService.listTrips();

      if (!response || !Array.isArray(response.trips)) {
        throw new Error("Invalid trips response from server");
      }

      return sortTripsByRecency(response.trips);
    },
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 0,
    networkMode: "online",
  });

export const useShares = () =>
  useQuery({
    queryKey: tripSharingKeys.shares(),
    queryFn: async (): Promise<SharedTrip[]> => {
      const response = await sharingService.listShares();

      if (!response || !Array.isArray(response.shares)) {
        throw new Error("Invalid shares response from server");
      }

      return sortSharesByRecency(response.shares);
    },
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 0,
    networkMode: "online",
  });

export const useCreateShare = () => {
  const queryClient = useQueryClient();

  return useMutation<SharedTrip, Error, CreateShareInput, ShareMutationContext>(
    {
      mutationKey: [...tripSharingKeys.root, "create"] as const,
      mutationFn: async (input: CreateShareInput): Promise<SharedTrip> => {
        if (!Number.isFinite(input.tripId) || input.tripId <= 0) {
          throw new Error("Select a valid trip first.");
        }

        const cachedShares =
          queryClient.getQueryData<SharedTrip[]>(tripSharingKeys.shares()) ??
          [];
        const hasActiveShare = cachedShares.some(
          (share) => share.trip_id === input.tripId && share.is_active,
        );

        if (hasActiveShare) {
          throw new Error("A share link already exists for this trip.");
        }

        const response = await sharingService.createShare({
          title: input.tripTitle,
          trip_id: input.tripId,
          notes: input.notes,
          itinerary_json: input.itineraryJson,
        });

        return response.share;
      },
      onMutate: async (input: CreateShareInput) => {
        if (!Number.isFinite(input.tripId) || input.tripId <= 0) {
          throw new Error("Select a valid trip first.");
        }

        const cachedShares =
          queryClient.getQueryData<SharedTrip[]>(tripSharingKeys.shares()) ??
          [];
        const hasActiveShare = cachedShares.some(
          (share) => share.trip_id === input.tripId && share.is_active,
        );

        if (hasActiveShare) {
          throw new Error("A share link already exists for this trip.");
        }

        await queryClient.cancelQueries({ queryKey: tripSharingKeys.shares() });

        const previousShares = queryClient.getQueryData<SharedTrip[]>(
          tripSharingKeys.shares(),
        );

        const optimisticId = -Date.now();
        const optimisticToken = `pending-${input.tripId}-${Date.now()}`;
        const optimisticShare: SharedTrip = {
          id: optimisticId,
          share_token: optimisticToken,
          title: input.tripTitle,
          trip_id: input.tripId,
          notes: input.notes,
          view_count: 0,
          is_active: true,
          share_url: sharingService.buildShareUrl(optimisticToken),
          created_at: new Date().toISOString(),
          expires_at: null,
          expires_in_days: null,
        };

        queryClient.setQueryData<SharedTrip[]>(
          tripSharingKeys.shares(),
          (current = []) => [optimisticShare, ...current],
        );

        return {
          previousShares,
          optimisticShareId: optimisticId,
        };
      },
      onError: (_error, _input, context) => {
        if (context?.previousShares) {
          queryClient.setQueryData(
            tripSharingKeys.shares(),
            context.previousShares,
          );
        }
      },
      onSuccess: (createdShare, _input, context) => {
        queryClient.setQueryData<SharedTrip[]>(
          tripSharingKeys.shares(),
          (current = []) =>
            current.map((item) =>
              item.id === context?.optimisticShareId ? createdShare : item,
            ),
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: tripSharingKeys.shares() });
      },
      retry: 0,
    },
  );
};

export const useRevokeShare = () => {
  const queryClient = useQueryClient();

  return useMutation<SharedTrip, Error, SharedTrip, ShareMutationContext>({
    mutationKey: [...tripSharingKeys.root, "revoke"] as const,
    mutationFn: async (share: SharedTrip): Promise<SharedTrip> => {
      if (!share.is_active) {
        throw new Error("This share link is already revoked.");
      }

      await sharingService.revokeShare(share.share_token);
      return share;
    },
    onMutate: async (share: SharedTrip) => {
      await queryClient.cancelQueries({ queryKey: tripSharingKeys.shares() });

      const previousShares = queryClient.getQueryData<SharedTrip[]>(
        tripSharingKeys.shares(),
      );

      queryClient.setQueryData<SharedTrip[]>(
        tripSharingKeys.shares(),
        (current = []) =>
          current.map((item) =>
            item.id === share.id
              ? {
                  ...item,
                  is_active: false,
                }
              : item,
          ),
      );

      return {
        previousShares,
        optimisticShareId: share.id,
      };
    },
    onError: (_error, _share, context) => {
      if (context?.previousShares) {
        queryClient.setQueryData(
          tripSharingKeys.shares(),
          context.previousShares,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tripSharingKeys.shares() });
    },
    retry: 0,
  });
};
