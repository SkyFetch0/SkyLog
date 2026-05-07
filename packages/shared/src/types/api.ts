export interface ApiResponse<T = unknown> {
  data: T
  meta?: {
    total?: number
    page?: number
    limit?: number
  }
}

export interface ApiError {
  statusCode: number
  error: string
  message: string
}