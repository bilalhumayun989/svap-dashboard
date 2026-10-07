'use server'
import { adminApi } from '@/lib/backend'
export async function verifyAdminSession() {
  try { await adminApi('/admin/access'); return { isAdmin:true as const } }
  catch (error) { return { isAdmin:false as const, error:error instanceof Error?error.message:'Admin access check failed' } }
}