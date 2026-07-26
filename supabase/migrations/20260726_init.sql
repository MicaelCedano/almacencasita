-- 1. Crear la tabla de Perfiles (profiles)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null default 'empleado' check (role in ('admin', 'empleado')),
  full_name text not null,
  approved boolean not null default false, -- Access approval flag
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Crear la tabla de Productos (products)
create table public.products (
  id uuid default gen_random_uuid() primary key,
  codigo text unique not null,
  nombre text not null,        -- Modelo de celular
  marca text not null,         -- Apple, Samsung, etc.
  color text not null,         -- Titanio Negro, etc.
  capacidad text not null,     -- 8+256GB, etc.
  descripcion text,
  cajas integer not null default 0 check (cajas >= 0),
  unidades_por_caja integer not null default 1 check (unidades_por_caja > 0),
  cantidad integer not null default 0 check (cantidad >= 0), -- Total celulares = cajas * unidades_por_caja
  fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
  fecha_actualizacion timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Crear la tabla de Movimientos (movements)
create table public.movements (
  id uuid default gen_random_uuid() primary key,
  producto_id uuid references public.products(id) on delete cascade not null,
  cantidad integer not null check (cantidad > 0), -- Cantidad en CAJAS
  tipo text not null check (tipo in ('Entrada', 'Salida')),
  motivo text not null,
  usuario_id uuid references public.profiles(id) on delete restrict not null,
  fecha timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Crear la tabla de Solicitudes (requests)
create table public.requests (
  id uuid default gen_random_uuid() primary key,
  producto_id uuid references public.products(id) on delete cascade not null,
  cantidad integer not null check (cantidad > 0), -- Cantidad en CAJAS
  motivo text not null,
  usuario_id uuid references public.profiles(id) on delete cascade not null,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Aprobado', 'Rechazado')),
  fecha timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar Row Level Security (RLS) en todas las tablas
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.movements enable row level security;
alter table public.requests enable row level security;

-- =========================================================================
-- Políticas de Seguridad (RLS)
-- =========================================================================

-- Políticas para 'profiles'
create policy "Permitir lectura de perfiles a usuarios autenticados"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Permitir actualizar perfil propio"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Permitir control de perfiles a administradores"
  on public.profiles for all
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Políticas para 'products'
create policy "Permitir lectura de productos a usuarios autenticados"
  on public.products for select
  to authenticated
  using (true);

create policy "Permitir control total de productos solo a administradores"
  on public.products for all
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Políticas para 'movements'
create policy "Permitir lectura de movimientos a usuarios autenticados"
  on public.movements for select
  to authenticated
  using (true);

create policy "Permitir registrar movimientos solo a administradores o sistema"
  on public.movements for insert
  to authenticated
  with check (
    (select role from public.profiles where id = auth.uid()) = 'admin'
    or auth.uid() = usuario_id
  );

-- Políticas para 'requests'
create policy "Permitir lectura de solicitudes a administradores o dueño"
  on public.requests for select
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
    or auth.uid() = usuario_id
  );

create policy "Permitir registrar solicitudes a cualquier almacenista"
  on public.requests for insert
  to authenticated
  with check (
    auth.uid() = usuario_id
  );

create policy "Permitir actualizar solicitudes a administradores"
  on public.requests for update
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- =========================================================================
-- Triggers y Funciones
-- =========================================================================

-- Trigger 1: Crear perfil automáticamente cuando se registra un usuario en Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, approved)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Usuario Nuevo'),
    coalesce(new.raw_user_meta_data->>'role', 'empleado'),
    coalesce((new.raw_user_meta_data->>'role' = 'admin'), false)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger 2: Actualizar automáticamente el stock de cajas y cantidad de unidades del producto al registrar un movimiento
create or replace function public.update_product_stock()
returns trigger as $$
begin
  if new.tipo = 'Entrada' then
    update public.products
    set cajas = cajas + new.cantidad,
        cantidad = (cajas + new.cantidad) * unidades_por_caja,
        fecha_actualizacion = timezone('utc'::text, now())
    where id = new.producto_id;
  elsif new.tipo = 'Salida' then
    -- Validar si hay cajas suficientes
    if (select cajas from public.products where id = new.producto_id) < new.cantidad then
      raise exception 'Stock de cajas insuficiente para realizar la salida.';
    end if;

    update public.products
    set cajas = cajas - new.cantidad,
        cantidad = (cajas - new.cantidad) * unidades_por_caja,
        fecha_actualizacion = timezone('utc'::text, now())
    where id = new.producto_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_movement_created
  after insert on public.movements
  for each row execute procedure public.update_product_stock();
