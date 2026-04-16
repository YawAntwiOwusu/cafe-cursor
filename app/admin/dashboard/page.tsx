"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Credit {
  id: string;
  code: string;
  link: string;
  isUsed: boolean;
  isTest: boolean;
  assignedAt: string | null;
  createdAt: string;
}

interface EligibleUser {
  id: string;
  email: string;
  name: string;
  company: string | null;
  approvalStatus: string;
  hasClaimed: boolean;
  claimedAt: string | null;
  credit: Credit | null;
}

interface Stats {
  totalCredits: number;
  usedCredits: number;
  availableCredits: number;
  testCredits: number;
  realCredits: number;
  totalEligible: number;
  claimedUsers: number;
  approvedUsers: number;
  pendingUsers: number;
}

interface DashboardData {
  stats: Stats;
  credits: Credit[];
  eligibleUsers: EligibleUser[];
}

/**
 * Dashboard de administración
 */
export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "credits">("users");
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddCreditModal, setShowAddCreditModal] = useState(false);
  const [importCreditsAsTest, setImportCreditsAsTest] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const usersFileInputRef = useRef<HTMLInputElement>(null);
  const creditsFileInputRef = useRef<HTMLInputElement>(null);

  // Verificar autenticación y cargar datos
  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/admin/dashboard");
      if (res.status === 401) {
        router.push("/admin");
        return;
      }
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin");
  };

  const executeAction = async (action: string, actionData: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: actionData }),
      });
      const json = await res.json();
      if (json.error) {
        alert(`Error: ${json.error}`);
      } else {
        alert(json.message || "Action completed");
        fetchDashboard(); // Recargar datos
      }
    } catch (err) {
      alert("Error running action");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignCredit = async (email: string, useTest: boolean = false) => {
    if (confirm(`Assign ${useTest ? "TEST" : "production"} credit to ${email}?`)) {
      await executeAction("ASSIGN_CREDIT", { email, useTestCredit: useTest });
    }
  };

  const handleRevokeCredit = async (userId: string, email: string) => {
    if (confirm(`Revoke credit from ${email}? The credit will become available again.`)) {
      await executeAction("REVOKE_CREDIT", { userId });
    }
  };

  const handleSendEmail = async (userId: string, email: string) => {
    if (confirm(`Send credit email to ${email}?`)) {
      await executeAction("SEND_CREDIT_EMAIL", { userId, locale: "en" });
    }
  };

  const runCsvImport = async (kind: "credits" | "users", file: File) => {
    setCsvImporting(true);
    try {
      const csv = await file.text();
      const res = await fetch("/api/admin/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          csv,
          options:
            kind === "credits" ? { isTest: importCreditsAsTest } : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert(`Import failed: ${json.error || res.statusText}`);
        return;
      }
      const lines = [
        `Created: ${json.created}`,
        `Skipped: ${json.skipped}`,
        typeof json.rowCount === "number" ? `Rows in file: ${json.rowCount}` : "",
      ];
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        lines.push("", "Sample issues:", ...json.errors.slice(0, 10));
      }
      alert(lines.filter(Boolean).join("\n"));
      await fetchDashboard();
    } catch {
      alert("Import failed (network or invalid file)");
    } finally {
      setCsvImporting(false);
      if (kind === "users") {
        if (usersFileInputRef.current) usersFileInputRef.current.value = "";
      } else if (creditsFileInputRef.current) {
        creditsFileInputRef.current.value = "";
      }
    }
  };

  // Filtrar datos
  const filteredUsers = data?.eligibleUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.company && u.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredCredits = data?.credits.filter(
    (c) =>
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.link.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="text-white">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Grid de fondo */}
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-20" />

      {/* Header */}
      <header className="relative border-b border-gray-800 bg-[#0a0a0a]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <svg
              className="h-8 w-8"
              viewBox="0 0 466.73 532.09"
              fill="currentColor"
            >
              <path d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39Z" />
            </svg>
            <div>
              <h1 className="text-lg font-bold">Cafe Cursor Admin</h1>
              <p className="text-xs text-gray-400">Administration</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="relative mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          <StatCard
            label="Total credits"
            value={data?.stats.totalCredits || 0}
            color="blue"
          />
          <StatCard
            label="Available"
            value={data?.stats.availableCredits || 0}
            color="green"
          />
          <StatCard
            label="Used"
            value={data?.stats.usedCredits || 0}
            color="orange"
          />
          <StatCard
            label="Test"
            value={data?.stats.testCredits || 0}
            color="purple"
          />
          <StatCard
            label="Eligible users"
            value={data?.stats.totalEligible || 0}
            color="cyan"
          />
          <StatCard
            label="Claimed"
            value={data?.stats.claimedUsers || 0}
            color="pink"
          />
        </div>

        {/* Controles */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("users")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "users"
                  ? "bg-white text-black"
                  : "border border-gray-700 hover:bg-gray-800"
              }`}
            >
              Users ({data?.eligibleUsers.length})
            </button>
            <button
              onClick={() => setActiveTab("credits")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "credits"
                  ? "bg-white text-black"
                  : "border border-gray-700 hover:bg-gray-800"
              }`}
            >
              Credits ({data?.credits.length})
            </button>
          </div>

          {/* Búsqueda y acciones */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm placeholder:text-gray-500 focus:border-white focus:outline-none"
            />
            <button
              onClick={() => setShowAddUserModal(true)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700"
            >
              + User
            </button>
            <button
              onClick={() => setShowAddCreditModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              + Credit
            </button>
            <input
              ref={usersFileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runCsvImport("users", f);
              }}
            />
            <input
              ref={creditsFileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runCsvImport("credits", f);
              }}
            />
            <button
              type="button"
              onClick={() => usersFileInputRef.current?.click()}
              disabled={csvImporting}
              className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-900/40 disabled:opacity-50"
            >
              Import users CSV
            </button>
            <button
              type="button"
              onClick={() => creditsFileInputRef.current?.click()}
              disabled={csvImporting}
              className="rounded-lg border border-cyan-700/60 bg-cyan-950/40 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-900/40 disabled:opacity-50"
            >
              Import credits CSV
            </button>
            <button
              onClick={fetchDashboard}
              disabled={actionLoading || csvImporting}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/30 px-4 py-3 text-xs text-gray-400">
          <label className="flex cursor-pointer items-center gap-2 text-gray-300">
            <input
              type="checkbox"
              checked={importCreditsAsTest}
              onChange={(e) => setImportCreditsAsTest(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-900"
            />
            Mark imported credits batch as test credits (production links stay normal if unchecked)
          </label>
          <p>
            <span className="font-medium text-gray-300">Users CSV:</span> header row with{" "}
            <code className="text-gray-500">email</code>, <code className="text-gray-500">name</code>, optional{" "}
            <code className="text-gray-500">company</code>, <code className="text-gray-500">approval_status</code> (or{" "}
            <code className="text-gray-500">status</code>), optional <code className="text-gray-500">role</code>. New
            emails only; duplicates in the DB are skipped.
          </p>
          <p>
            <span className="font-medium text-gray-300">Credits CSV:</span> one Cursor referral URL per line, or a CSV
            with a <code className="text-gray-500">link</code> or <code className="text-gray-500">url</code> column.
            Optional <code className="text-gray-500">status</code> value <code className="text-gray-500">taken</code>{" "}
            marks the row as already used. Existing codes/links are skipped.
          </p>
        </div>

        {/* Tabla de Usuarios */}
        {activeTab === "users" && (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Credit</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredUsers?.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-900/50">
                    <td className="px-4 py-3 font-mono text-xs">{user.email}</td>
                    <td className="px-4 py-3">{user.name}</td>
                    <td className="px-4 py-3 text-gray-400">{user.company || "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.approvalStatus} />
                    </td>
                    <td className="px-4 py-3">
                      {user.hasClaimed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400">
                          ✓ {user.credit?.code}
                          {user.credit?.isTest && " (TEST)"}
                        </span>
                      ) : (
                        <span className="text-gray-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {!user.hasClaimed && user.approvalStatus === "approved" && (
                          <>
                            <button
                              onClick={() => handleAssignCredit(user.email, false)}
                              disabled={actionLoading}
                              className="rounded bg-blue-600 px-2 py-1 text-xs hover:bg-blue-700 disabled:opacity-50"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => handleAssignCredit(user.email, true)}
                              disabled={actionLoading}
                              className="rounded bg-purple-600 px-2 py-1 text-xs hover:bg-purple-700 disabled:opacity-50"
                            >
                              Test
                            </button>
                          </>
                        )}
                        {user.hasClaimed && (
                          <>
                            <button
                              onClick={() => handleSendEmail(user.id, user.email)}
                              disabled={actionLoading}
                              className="rounded bg-cyan-600 px-2 py-1 text-xs hover:bg-cyan-700 disabled:opacity-50"
                              title="Send email with credit link"
                            >
                              📧 Email
                            </button>
                            <button
                              onClick={() => handleRevokeCredit(user.id, user.email)}
                              disabled={actionLoading}
                              className="rounded bg-red-600 px-2 py-1 text-xs hover:bg-red-700 disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tabla de Créditos */}
        {activeTab === "credits" && (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Link</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredCredits?.map((credit) => (
                  <tr key={credit.id} className="hover:bg-gray-900/50">
                    <td className="px-4 py-3 font-mono text-xs">{credit.code}</td>
                    <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-gray-400">
                      {credit.link}
                    </td>
                    <td className="px-4 py-3">
                      {credit.isTest ? (
                        <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-400">
                          TEST
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-400">
                          Production
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {credit.isUsed ? (
                        <span className="rounded-full bg-orange-500/20 px-2 py-1 text-xs text-orange-400">
                          Used
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {credit.assignedAt
                        ? new Date(credit.assignedAt).toLocaleDateString("en-US")
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Agregar Usuario */}
      {showAddUserModal && (
        <AddUserModal
          onClose={() => setShowAddUserModal(false)}
          onSubmit={async (userData) => {
            await executeAction("ADD_ELIGIBLE_USER", userData);
            setShowAddUserModal(false);
          }}
        />
      )}

      {/* Modal Agregar Crédito */}
      {showAddCreditModal && (
        <AddCreditModal
          onClose={() => setShowAddCreditModal(false)}
          onSubmit={async (creditData) => {
            await executeAction("ADD_CREDIT", creditData);
            setShowAddCreditModal(false);
          }}
        />
      )}
    </div>
  );
}

// Componentes auxiliares
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "border-blue-500/30 bg-blue-500/10",
    green: "border-green-500/30 bg-green-500/10",
    orange: "border-orange-500/30 bg-orange-500/10",
    purple: "border-purple-500/30 bg-purple-500/10",
    cyan: "border-cyan-500/30 bg-cyan-500/10",
    pink: "border-pink-500/30 bg-pink-500/10",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: "bg-green-500/20 text-green-400",
    pending_approval: "bg-yellow-500/20 text-yellow-400",
    declined: "bg-red-500/20 text-red-400",
    waitlist: "bg-gray-500/20 text-gray-400",
    invited: "bg-blue-500/20 text-blue-400",
  };

  const labels: Record<string, string> = {
    approved: "Approved",
    pending_approval: "Pending",
    declined: "Declined",
    waitlist: "Waitlist",
    invited: "Invited",
  };

  return (
    <span className={`rounded-full px-2 py-1 text-xs ${styles[status] || "bg-gray-500/20 text-gray-400"}`}>
      {labels[status] || status}
    </span>
  );
}

function AddUserModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, string>) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-[#0a0a0a] p-6">
        <h2 className="mb-4 text-lg font-bold">Add eligible user</h2>
        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder:text-gray-500 focus:border-white focus:outline-none"
          />
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder:text-gray-500 focus:border-white focus:outline-none"
          />
          <input
            type="text"
            placeholder="Company (optional)"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder:text-gray-500 focus:border-white focus:outline-none"
          />
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-700 py-3 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ email, name, company, approvalStatus: "approved" })}
            className="flex-1 rounded-lg bg-white py-3 font-medium text-black hover:opacity-90"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCreditModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [code, setCode] = useState("");
  const [link, setLink] = useState("");
  const [isTest, setIsTest] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-[#0a0a0a] p-6">
        <h2 className="mb-4 text-lg font-bold">Add credit</h2>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Code (e.g. ABC123XYZ)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder:text-gray-500 focus:border-white focus:outline-none"
          />
          <input
            type="url"
            placeholder="Full link (https://cursor.com/...)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder:text-gray-500 focus:border-white focus:outline-none"
          />
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isTest}
              onChange={(e) => setIsTest(e.target.checked)}
              className="h-4 w-4 rounded border-gray-700 bg-gray-900"
            />
            <span className="text-sm text-gray-300">Test credit (TEST)</span>
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-700 py-3 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ code, link, isTest })}
            className="flex-1 rounded-lg bg-white py-3 font-medium text-black hover:opacity-90"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
