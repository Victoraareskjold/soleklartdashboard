"use client";

import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { createLead } from "@/lib/api";
import { CLIENT_ROUTES } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}

const Input = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: InputProps) => (
  <div className="mb-3">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  </div>
);

export default function CreateLead() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();

  // Inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }
    if (!teamId) {
      toast.error("No team selected");
      setLoading(false);
      return;
    }
    if (!installerGroupId) {
      toast.error("No installergroup selected");
      setLoading(false);
      return;
    }

    try {
      const lead = await createLead({
        team_id: teamId,
        installer_group_id: installerGroupId,
        assigned_to: user.id,
        name,
        email,
        phone,
        status: "new",
        priority: "iron",
      });
      toast.success(`Lead "${lead.name}" created!`);
      router.push(CLIENT_ROUTES.DASHBOARD + "/leads" + lead.id);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    }

    setLoading(false);
  };
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <Input
          label="Name"
          value={name}
          onChange={setName}
          placeholder="Lead name"
        />
        <Input
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          placeholder="Lead email"
        />
        <Input
          label="Phone"
          value={phone}
          onChange={setPhone}
          placeholder="Lead phone"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Lead"}
        </button>
      </form>
    </div>
  );
}
