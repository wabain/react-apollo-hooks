import {
  ApolloClient,
  ApolloError,
  OperationVariables,
  SubscriptionOptions,
} from 'apollo-client';
import { DocumentNode } from 'graphql';
import { useEffect, useRef, useState } from 'react';

import { UseClientOptions, useApolloClient } from './ApolloContext';
import actHack from './internal/actHack';
import { Omit, objToKey } from './utils';

export type OnSubscriptionData<TData> = (
  options: OnSubscriptionDataOptions<TData>
) => any;

export interface OnSubscriptionDataOptions<TData> {
  client: ApolloClient<any>;
  subscriptionData: SubscriptionHookResult<TData>;
}

export interface SubscriptionHookOptions<TData, TVariables>
  extends Omit<SubscriptionOptions<TVariables>, 'query'> {
  onSubscriptionData?: OnSubscriptionData<TData>;
}

export interface SubscriptionHookResult<TData> {
  data?: TData;
  error?: ApolloError;
  loading: boolean;
}

export function useSubscription<
  TData = any,
  TVariables = OperationVariables,
  TCacheShape = object
>(
  query: DocumentNode,
  {
    onSubscriptionData,
    client: clientFromOptions,
    ...options
  }: SubscriptionHookOptions<TData, TVariables> &
    UseClientOptions<TCacheShape> = {}
): SubscriptionHookResult<TData> {
  const client = useApolloClient({ client: clientFromOptions });
  const onSubscriptionDataRef = useRef<
    OnSubscriptionData<TData> | null | undefined
  >(null);
  const [result, setResultBase] = useState<SubscriptionHookResult<TData>>({
    loading: true,
  });

  onSubscriptionDataRef.current = onSubscriptionData;

  function setResult(newResult: SubscriptionHookResult<TData>) {
    // A hack to get rid React warnings during tests.
    actHack(() => {
      setResultBase(newResult);
    });
  }

  useEffect(
    () => {
      const subscription = client
        .subscribe({
          ...options,
          query,
        })
        .subscribe(
          nextResult => {
            const newResult = {
              data: nextResult.data,
              error: undefined,
              loading: false,
            };
            setResult(newResult);
            if (onSubscriptionDataRef.current) {
              onSubscriptionDataRef.current({
                client,
                subscriptionData: newResult,
              });
            }
          },
          error => {
            setResult({ loading: false, data: result.data, error });
          }
        );
      return () => {
        setResult({ loading: true });
        subscription.unsubscribe();
      };
    },
    [query, options && objToKey(options)]
  );

  return result;
}
