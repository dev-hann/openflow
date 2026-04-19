import React from "react";
import { useTheme } from "react-native-paper";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ProviderForm } from "../components/ProviderForm";
import { SPACING } from "../constants/theme";

export type SettingsStackParamList = {
  SettingsMain: undefined;
  ProviderEdit: {
    editProvider?: { id: string; name: string; baseUrl: string; apiKey: string; model: string };
  };
};

export function ProviderEditScreen({ navigation, route }: NativeStackScreenProps<SettingsStackParamList, "ProviderEdit">) {
  const theme = useTheme();
  const { editProvider } = route.params ?? {};

  return (
    <ProviderForm
      editProvider={editProvider ?? null}
      onComplete={() => navigation.goBack()}
    />
  );
}
