import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { isDatabaseConnectionError, jsonDatabaseUnavailable } from "@/lib/db-errors";

/**
 * GET /api/admin/dashboard - Obtener datos del dashboard
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Obtener estadísticas
    const [
      totalCredits,
      usedCredits,
      testCredits,
      totalEligible,
      claimedUsers,
      approvedUsers,
    ] = await Promise.all([
      prisma.credit.count(),
      prisma.credit.count({ where: { isUsed: true } }),
      prisma.credit.count({ where: { isTest: true } }),
      prisma.eligibleUser.count(),
      prisma.eligibleUser.count({ where: { hasClaimed: true } }),
      prisma.eligibleUser.count({ where: { approvalStatus: "approved" } }),
    ]);

    // Obtener créditos con usuarios asignados
    const credits = await prisma.credit.findMany({
      orderBy: [
        { isUsed: "desc" },
        { assignedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 100,
    });

    // Obtener usuarios elegibles con sus créditos
    const eligibleUsers = await prisma.eligibleUser.findMany({
      orderBy: [
        { hasClaimed: "desc" },
        { claimedAt: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        credit: true,
      },
      take: 200,
    });

    return NextResponse.json({
      stats: {
        totalCredits,
        usedCredits,
        availableCredits: totalCredits - usedCredits,
        testCredits,
        realCredits: totalCredits - testCredits,
        totalEligible,
        claimedUsers,
        approvedUsers,
        pendingUsers: approvedUsers - claimedUsers,
      },
      credits,
      eligibleUsers,
    });
  } catch (error) {
    console.error("❌ [ADMIN] Error obteniendo dashboard:", error);
    if (isDatabaseConnectionError(error)) {
      return jsonDatabaseUnavailable();
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
