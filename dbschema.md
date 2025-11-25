-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.electrical_installation_categories (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
CONSTRAINT electrical_installation_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.electrical_installation_items (
installer_group_id uuid NOT NULL,
category_id uuid NOT NULL,
name text NOT NULL,
price_per numeric NOT NULL DEFAULT '0'::numeric,
id uuid NOT NULL DEFAULT gen_random_uuid(),
extra_costs numeric NOT NULL DEFAULT '0'::numeric,
CONSTRAINT electrical_installation_items_pkey PRIMARY KEY (id),
CONSTRAINT electrician_installation_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.electrical_installation_categories(id),
CONSTRAINT electrical_installation_items_installer_group_id_fkey FOREIGN KEY (installer_group_id) REFERENCES public.installer_groups(id)
);
CREATE TABLE public.email_accounts (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
installer_group_id uuid NOT NULL,
provider text NOT NULL CHECK (provider = ANY (ARRAY['outlook'::text, 'gmail'::text])),
email text UNIQUE,
access_token text NOT NULL,
refresh_token text NOT NULL,
id_token text,
scope text,
token_type text NOT NULL DEFAULT 'Bearer'::text,
expires_at timestamp with time zone NOT NULL,
ext_expires_at timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT email_accounts_pkey PRIMARY KEY (id),
CONSTRAINT email_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
CONSTRAINT email_accounts_installer_group_id_fkey FOREIGN KEY (installer_group_id) REFERENCES public.installer_groups(id)
);
CREATE TABLE public.email_messages (
id uuid NOT NULL DEFAULT gen_random_uuid(),
installer_group_id uuid,
lead_id uuid,
message_id text NOT NULL UNIQUE,
conversation_id text NOT NULL,
subject text,
from_address text,
to_addresses ARRAY,
body text,
body_preview text,
received_at timestamp with time zone,
has_attachments boolean DEFAULT false,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT email_messages_pkey PRIMARY KEY (id),
CONSTRAINT email_messages_installer_group_id_fkey FOREIGN KEY (installer_group_id) REFERENCES public.installer_groups(id),
CONSTRAINT email_messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id)
);
CREATE TABLE public.estimates (
id uuid NOT NULL DEFAULT gen_random_uuid(),
lead_id uuid NOT NULL,
created_at timestamp without time zone NOT NULL DEFAULT now(),
updated_at timestamp without time zone DEFAULT now(),
image_url text,
total_panels integer,
selected_panel_type text,
selected_roof_type text,
checked_roof_data jsonb,
selected_el_price numeric,
yearly_cost numeric,
yearly_cost2 numeric,
yearly_prod numeric,
desired_kwh numeric,
coverage_percentage numeric,
CONSTRAINT estimates_pkey PRIMARY KEY (id),
CONSTRAINT estimates_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id)
);
CREATE TABLE public.installer_group_members (
id uuid NOT NULL DEFAULT gen_random_uuid(),
installer_group_id uuid NOT NULL,
user_id uuid NOT NULL,
role text NOT NULL CHECK (role = ANY (ARRAY['installer'::text, 'viewer'::text])),
created_at timestamp without time zone NOT NULL DEFAULT now(),
CONSTRAINT installer_group_members_pkey PRIMARY KEY (id),
CONSTRAINT installer_group_members_installer_group_id_fkey FOREIGN KEY (installer_group_id) REFERENCES public.installer_groups(id),
CONSTRAINT installer_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.installer_groups (
id uuid NOT NULL DEFAULT gen_random_uuid(),
team_id uuid NOT NULL,
name text NOT NULL,
created_at timestamp without time zone NOT NULL DEFAULT now(),
CONSTRAINT installer_groups_pkey PRIMARY KEY (id),
CONSTRAINT installer_groups_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
CONSTRAINT installer_groups_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id)
);
CREATE TABLE public.lead_note_tags (
id uuid NOT NULL DEFAULT gen_random_uuid(),
note_id uuid NOT NULL,
user_id uuid NOT NULL,
created_at timestamp without time zone NOT NULL DEFAULT now(),
source text NOT NULL DEFAULT 'note'::text,
CONSTRAINT lead_note_tags_pkey PRIMARY KEY (id),
CONSTRAINT lead_note_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
CONSTRAINT lead_note_tags_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.lead_notes(id)
);
CREATE TABLE public.lead_notes (
id uuid NOT NULL DEFAULT gen_random_uuid(),
lead_id uuid NOT NULL,
user_id uuid NOT NULL,
content text NOT NULL,
created_at timestamp without time zone NOT NULL DEFAULT now(),
source text NOT NULL DEFAULT 'note'::text,
note_id uuid,
CONSTRAINT lead_notes_pkey PRIMARY KEY (id),
CONSTRAINT lead_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
CONSTRAINT lead_notes_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.lead_notes(id),
CONSTRAINT lead_notes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id)
);
CREATE TABLE public.leads (
id uuid NOT NULL DEFAULT gen_random_uuid(),
team_id uuid NOT NULL,
installer_group_id uuid NOT NULL,
assigned_to uuid,
person_info text NOT NULL,
birth_date timestamp without time zone,
company text,
address text DEFAULT ''::text,
created_at timestamp without time zone NOT NULL DEFAULT now(),
updated_at timestamp without time zone DEFAULT now(),
priority text DEFAULT 'iron'::text,
own_consumption numeric,
voltage numeric,
phases numeric,
roof_type_id uuid,
roof_slope numeric,
roof_age numeric,
electricity_price_avg numeric,
main_fuse numeric,
esitmate_id uuid,
status text,
email text,
phone text,
CONSTRAINT leads_pkey PRIMARY KEY (id),
CONSTRAINT leads_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
CONSTRAINT leads_installer_group_id_fkey FOREIGN KEY (installer_group_id) REFERENCES public.installer_groups(id),
CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id),
CONSTRAINT leads_roof_type_id_fkey FOREIGN KEY (roof_type_id) REFERENCES public.roof_types(id),
CONSTRAINT leads_esitmate_id_fkey FOREIGN KEY (esitmate_id) REFERENCES public.estimates(id)
);
CREATE TABLE public.mount_items (
id uuid NOT NULL DEFAULT gen_random_uuid(),
roof_type_id uuid NOT NULL,
product_id uuid,
price_per numeric NOT NULL DEFAULT '1500'::numeric,
installer_group_id uuid NOT NULL DEFAULT gen_random_uuid(),
supplier_id uuid,
CONSTRAINT mount_items_pkey PRIMARY KEY (id),
CONSTRAINT mounting_items_roof_type_id_fkey FOREIGN KEY (roof_type_id) REFERENCES public.roof_types(id),
CONSTRAINT mounting_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
CONSTRAINT mount_items_installer_group_id_fkey FOREIGN KEY (installer_group_id) REFERENCES public.installer_groups(id),
CONSTRAINT mount_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
);
CREATE TABLE public.mount_volume_reduction (
id uuid NOT NULL DEFAULT gen_random_uuid(),
amount numeric NOT NULL DEFAULT '0'::numeric,
reduction numeric NOT NULL DEFAULT '0'::numeric,
amount2 numeric NOT NULL DEFAULT '0'::numeric,
installer_group_id uuid NOT NULL,
number numeric DEFAULT '1'::numeric,
CONSTRAINT mount_volume_reduction_pkey PRIMARY KEY (id),
CONSTRAINT mounting_volume_reduction_installer_group_id_fkey FOREIGN KEY (installer_group_id) REFERENCES public.installer_groups(id)
);
CREATE TABLE public.product_categories (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
CONSTRAINT product_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_subcategories (
id uuid NOT NULL DEFAULT gen_random_uuid(),
category_id uuid NOT NULL,
name text NOT NULL,
CONSTRAINT product_subcategories_pkey PRIMARY KEY (id),
CONSTRAINT product_subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id)
);
CREATE TABLE public.products (
id uuid NOT NULL DEFAULT gen_random_uuid(),
supplier_id uuid NOT NULL,
category_id uuid NOT NULL,
subcategory_id uuid,
name text NOT NULL,
price_ex_vat numeric NOT NULL DEFAULT '0'::numeric,
attachment text,
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT products_pkey PRIMARY KEY (id),
CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id),
CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id),
CONSTRAINT products_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.product_subcategories(id)
);
CREATE TABLE public.roof_types (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
CONSTRAINT roof_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.supplier_categories (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
markup_percentage numeric NOT NULL DEFAULT '0'::numeric,
installer_group_id uuid DEFAULT gen_random_uuid(),
CONSTRAINT supplier_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.suppliers (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
category text,
CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.team_members (
id uuid NOT NULL DEFAULT gen_random_uuid(),
team_id uuid NOT NULL,
user_id uuid NOT NULL,
role text NOT NULL DEFAULT 'member'::text CHECK (role = ANY (ARRAY['member'::text, 'admin'::text, 'installer'::text])),
created_at timestamp without time zone NOT NULL DEFAULT now(),
CONSTRAINT team_members_pkey PRIMARY KEY (id),
CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.teams (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
created_at timestamp without time zone NOT NULL DEFAULT now(),
CONSTRAINT teams_pkey PRIMARY KEY (id),
CONSTRAINT teams_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
id uuid NOT NULL DEFAULT gen_random_uuid(),
email text NOT NULL UNIQUE,
name text,
password_hash text,
created_at timestamp without time zone DEFAULT now(),
CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.work_items (
id uuid NOT NULL DEFAULT gen_random_uuid(),
category text NOT NULL,
name text NOT NULL,
cost_per numeric DEFAULT '0'::numeric,
markup_percent numeric DEFAULT '0'::numeric,
installer_group_id uuid NOT NULL,
CONSTRAINT work_items_pkey PRIMARY KEY (id),
CONSTRAINT work_items_installer_group_id_fkey FOREIGN KEY (installer_group_id) REFERENCES public.installer_groups(id)
);
