-- 1. Crear la tabla de Perfiles (profiles) — auth custom, sin Supabase Auth
create table public.profiles (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  password_hash text not null,
  role text not null default 'empleado' check (role in ('admin', 'empleado')),
  full_name text not null,
  approved boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Crear la tabla de Productos (products)
create table public.products (
  id uuid default gen_random_uuid() primary key,
  codigo text unique not null,
  nombre text not null,
  marca text not null,
  color text not null,
  capacidad text not null,
  descripcion text,
  cajas integer not null default 0 check (cajas >= 0),
  unidades_por_caja integer not null default 1 check (unidades_por_caja > 0),
  cantidad integer not null default 0 check (cantidad >= 0),
  fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
  fecha_actualizacion timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Crear la tabla de Movimientos (movements)
create table public.movements (
  id uuid default gen_random_uuid() primary key,
  producto_id uuid references public.products(id) on delete cascade not null,
  cantidad integer not null check (cantidad > 0),
  tipo text not null check (tipo in ('Entrada', 'Salida')),
  motivo text not null,
  usuario_id uuid references public.profiles(id) on delete restrict not null,
  fecha timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Crear la tabla de Solicitudes (requests)
create table public.requests (
  id uuid default gen_random_uuid() primary key,
  items jsonb not null default '[]'::jsonb,
  motivo text not null,
  usuario_id uuid references public.profiles(id) on delete cascade not null,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Aprobado', 'Rechazado')),
  tipo text not null default 'Salida' check (tipo in ('Entrada', 'Salida')),
  fecha timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Deshabilitar RLS — todo pasa por Server Actions/Components (seguro por cookie)
alter table public.profiles disable row level security;
alter table public.products disable row level security;
alter table public.movements disable row level security;
alter table public.requests disable row level security;

-- Trigger: Actualizar automáticamente el stock al registrar un movimiento
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

-- Otorgar permisos sobre tablas, secuencias y funciones a los roles de la API de Supabase
grant all privileges on all tables in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all functions in schema public to postgres, anon, authenticated, service_role;
