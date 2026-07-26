'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { login, signup } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Warehouse, Lock, User, Shield } from 'lucide-react'
import { toast } from 'sonner'

const loginSchema = z.object({
  username: z.string().min(3, { message: 'El usuario debe tener al menos 3 caracteres' }),
  password: z.string().min(4, { message: 'La contraseña debe tener al menos 4 caracteres' }),
})

const signupSchema = z.object({
  fullName: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres' }),
  username: z.string().min(3, { message: 'El usuario debe tener al menos 3 caracteres' }),
  password: z.string().min(4, { message: 'La contraseña debe tener al menos 4 caracteres' }),
  role: z.enum(['admin', 'empleado']),
})

type LoginFormValues = z.infer<typeof loginSchema>
type SignupFormValues = z.infer<typeof signupSchema>

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const {
    register: registerSignup,
    handleSubmit: handleSignupSubmit,
    setValue: setSignupValue,
    formState: { errors: signupErrors },
    watch: watchSignup,
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: 'empleado',
    },
  })

  const selectedRole = watchSignup('role')

  const onLogin = async (data: LoginFormValues) => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await login(null, data)
      if (res && !res.success) {
        setErrorMessage(res.error || 'Credenciales incorrectas.')
      } else if (res && res.success) {
        window.location.href = '/dashboard'
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  const onSignup = async (data: SignupFormValues) => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await signup(null, data)
      if (res && !res.success) {
        setErrorMessage(res.error || 'Error al crear la cuenta.')
      } else if (res && res.isPendingApproval) {
        toast.info(res.message || 'Tu cuenta está pendiente de aprobación.')
        setErrorMessage(null)
        setActiveTab('login')
      } else if (res && res.success) {
        toast.success('Cuenta creada exitosamente. Redirigiendo...')
        window.location.href = '/dashboard'
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al registrar la cuenta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-50 relative overflow-hidden px-4">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-900/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
            <Warehouse className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Almacén Casita</h1>
          <p className="text-sm text-zinc-400 mt-1">Control de Inventario Inteligente</p>
        </div>

        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1">
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950/80 rounded-lg border border-zinc-800/80 mb-4">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login')
                  setErrorMessage(null)
                }}
                className={`py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'login'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup')
                  setErrorMessage(null)
                }}
                className={`py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'signup'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Crear Cuenta
              </button>
            </div>
            <CardTitle className="text-xl text-center">
              {activeTab === 'login' ? 'Bienvenido de nuevo' : 'Regístrate en el sistema'}
            </CardTitle>
            <CardDescription className="text-center text-zinc-400">
              {activeTab === 'login'
                ? 'Ingresa tu usuario y contraseña para acceder'
                : 'Crea tu usuario asignando un rol de trabajo'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-md">
                {errorMessage}
              </div>
            )}

            {activeTab === 'login' ? (
              <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Usuario</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="Ej. admin"
                      className="pl-9 bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-zinc-100 placeholder-zinc-500"
                      {...registerLogin('username')}
                    />
                  </div>
                  {loginErrors.username && (
                    <p className="text-xs text-red-400">{loginErrors.username.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••"
                      className="pl-9 bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-zinc-100 placeholder-zinc-500"
                      {...registerLogin('password')}
                    />
                  </div>
                  {loginErrors.password && (
                    <p className="text-xs text-red-400">{loginErrors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando Sesión...
                    </>
                  ) : (
                    'Entrar al Almacén'
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignupSubmit(onSignup)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nombre Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Juan Pérez"
                      className="pl-9 bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-zinc-100 placeholder-zinc-500"
                      {...registerSignup('fullName')}
                    />
                  </div>
                  {signupErrors.fullName && (
                    <p className="text-xs text-red-400">{signupErrors.fullName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-username">Nombre de Usuario</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="Ej. admin"
                      className="pl-9 bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-zinc-100 placeholder-zinc-500"
                      {...registerSignup('username')}
                    />
                  </div>
                  {signupErrors.username && (
                    <p className="text-xs text-red-400">{signupErrors.username.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Mín. 4 caracteres"
                      className="pl-9 bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-zinc-100 placeholder-zinc-500"
                      {...registerSignup('password')}
                    />
                  </div>
                  {signupErrors.password && (
                    <p className="text-xs text-red-400">{signupErrors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-role">Rol de Trabajo</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-3 h-4 w-4 text-zinc-500 z-10" />
                    <Select
                      value={selectedRole}
                      onValueChange={(val) => {
                        if (val) setSignupValue('role', val)
                      }}
                    >
                      <SelectTrigger className="pl-9 bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-zinc-100">
                        <SelectValue placeholder="Seleccionar rol" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                        <SelectItem value="empleado">Almacenista (Solicitudes de Salida)</SelectItem>
                        <SelectItem value="admin">Administrador (Control Total)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando Cuenta...
                    </>
                  ) : (
                    'Registrar e Iniciar'
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex flex-col text-center border-t border-zinc-800/80 pt-4 text-xs text-zinc-500 space-y-1">
            <p>Almacén Casita v1.0.0</p>
            <p className="text-[10px]">Autenticación por nombre de usuario con hash seguro.</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
