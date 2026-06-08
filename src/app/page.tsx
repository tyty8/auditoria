import { StoreProvider } from "@/components/store";
import AdminApp from "@/components/admin-app";

export default function Home() {
  return (
    <StoreProvider>
      <AdminApp />
    </StoreProvider>
  );
}
