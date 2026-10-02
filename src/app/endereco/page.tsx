import { Topbar } from "@/components/Topbar";
import { AddressSearch } from "@/components/AddressSearch";

export default function AddressPage() {
  return (
    <>
      <Topbar title="Buscar endereço" sub="Localize a via e veja os radares do estudo mais próximos" />
      <div className="content" style={{ maxWidth: 1100 }}>
        <AddressSearch />
      </div>
    </>
  );
}
