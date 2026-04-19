import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ProviderForm } from "../components/ProviderForm";

export type SettingsStackParamList = {
  SettingsMain: undefined;
  ProviderEdit: {
    editProvider?: {
      id: string;
      name: string;
      baseUrl: string;
      apiKey: string;
      model: string;
    };
  };
};

export function ProviderEditScreen({
  navigation,
  route,
}: NativeStackScreenProps<SettingsStackParamList, "ProviderEdit">) {
  const { editProvider } = route.params ?? {};

  return (
    <ProviderForm
      editProvider={editProvider ?? null}
      onComplete={() => navigation.goBack()}
    />
  );
}
