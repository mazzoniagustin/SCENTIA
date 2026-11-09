# Skill: Database Design & Modeling (Fragrance Domain)

## Entidades Principales
1. **Perfume:** id, name, brand, gender, concentration (EDT, EDP, Parfum), release_year, description, image_url.
2. **Note:** id, name, category (top, heart, base).
3. **Accord:** id, name (amaderado, cítrico, dulce, floral, etc.).
4. **PerfumeNote:** perfume_id, note_id, note_type.
5. **PerfumeAccord:** perfume_id, accord_id, intensity.
6. **UserCollection:** user_id, perfume_id, status (owned, wishlist, tested), rating, personal_notes.

## Reglas
- Usar PostgreSQL + Prisma ORM o Supabase.
- Claves primarias CUID o UUID.
- Incluir índices en campos de búsqueda frecuente (brand, gender, concentration).
