# backend/api/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
import math
from .models import (
    Product, CashMovement, InventoryChange, Sale, SaleItem, Role, 
    UserQuery, Supplier, UserStorage, LowStockReport, RecipeIngredient, LossRecord,
    Production, ProductionItem
)
from .models import ResetToken
from .models import Purchase
from .models import Order, OrderItem

User = get_user_model()  # Usa el modelo de usuario personalizado

# Serializer para el modelo de proveedor
class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

# Serializer para UserStorage
class UserStorageSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserStorage
        fields = ['id', 'key', 'value', 'updated_at']

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'

# Serializer para el modelo de usuario (usando el modelo extendido)
class UserSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', write_only=True, allow_null=True
    )

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'role_id', 'is_active', 'is_locked', 'failed_login_attempts', 'locked_at', 'lock_type')
        read_only_fields = ('is_active', 'is_locked', 'failed_login_attempts', 'locked_at', 'lock_type')


class ResetTokenSerializer(serializers.ModelSerializer):
    target_email = serializers.ReadOnlyField(source='target_user.email')
    generated_by_username = serializers.ReadOnlyField(source='generated_by.username')

    class Meta:
        model = ResetToken
        fields = ('id', 'target_user', 'target_email', 'generated_by', 'generated_by_username', 'created_at', 'expires_at', 'used')
        read_only_fields = ('id', 'target_user', 'target_email', 'generated_by', 'generated_by_username', 'created_at', 'expires_at', 'used')

# Serializer para que el Gerente actualice usuarios (SIN CONTRASEÑA)
class UserUpdateSerializer(serializers.ModelSerializer):
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', required=False, allow_null=True
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'first_name', 'last_name', 'role_id', 'is_active', 'password')
        extra_kwargs = {
            'username': {'required': False},
            'email': {'required': False},
            'first_name': {'required': False},
            'last_name': {'required': False},
            'is_active': {'required': False},
            'password': {'write_only': True, 'required': False}
        }

    def update(self, instance, validated_data):
        # Manejar la contraseña por separado si se proporciona
        password = validated_data.pop('password', None)
        
        # Actualizar otros campos
        instance = super().update(instance, validated_data)
        
        # Si se proporcionó una nueva contraseña, actualizarla
        if password:
            instance.set_password(password)
            instance.save()
        
        return instance


# Serializer para crear usuarios (incluye el campo de contraseña)
class UserCreateSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'first_name', 'last_name', 'password', 'role_name')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        role_name = validated_data.pop('role_name', 'Cajero')
        
        # Buscar o crear el rol
        role, created = Role.objects.get_or_create(name=role_name)
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=role
        )
        return user

# Serializer para los ingredientes de una receta
class RecipeIngredientSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.name', read_only=True)

    class Meta:
        model = RecipeIngredient
        fields = ['id', 'product', 'ingredient', 'ingredient_name', 'quantity', 'unit']
        read_only_fields = ['product']

# Serializer for writing recipe ingredients
class RecipeIngredientWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecipeIngredient
        fields = ['ingredient', 'quantity', 'unit']

# Serializer para el modelo de producto
class ProductSerializer(serializers.ModelSerializer):
    estado = serializers.SerializerMethodField()
    recipe = RecipeIngredientSerializer(many=True, read_only=True)
    recipe_ingredients = RecipeIngredientWriteSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'stock', 'recipe_yield', 'loss_rate', 'low_stock_threshold', 'high_stock_multiplier', 'category', 'is_ingredient', 'unit', 'recipe', 'recipe_ingredients', 'estado']

    def validate_recipe_yield(self, value):
        try:
            v = int(value)
        except Exception:
            raise serializers.ValidationError('Rendimiento de la receta inválido')
        if v < 1:
            raise serializers.ValidationError('Rendimiento de la receta debe ser al menos 1')
        # Verificar que el valor se está procesando correctamente
        return v

    def validate_loss_rate(self, value):
        try:
            v = float(value)
        except Exception:
            raise serializers.ValidationError('Tasa de pérdida inválida')
        if v < 0 or v > 1:
            raise serializers.ValidationError('Tasa de pérdida debe estar entre 0% y 100% (0.0 - 1.0)')
        return value

    def get_estado(self, obj):
        # Lógica: Activo si stock > 0, Inactivo si stock == 0
        if obj.stock > 0:
            return 'Activo'
        return 'Inactivo'
    
    def validate_name(self, value):
        if value is not None and (not value or not value.strip()):
            raise serializers.ValidationError("El nombre del producto es obligatorio.")
        return value.strip() if value else value
    
    def validate_price(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("El precio debe ser mayor a 0.")
        return value
    
    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("El stock no puede ser negativo.")
        return value
    
    def validate_low_stock_threshold(self, value):
        if value < 0:
            raise serializers.ValidationError('El umbral de stock bajo no puede ser negativo.')
        return value
    
    def validate_high_stock_multiplier(self, value):
        if value <= 1:
            raise serializers.ValidationError('El multiplicador de stock alto debe ser mayor a 1.')
        return value

    def create(self, validated_data):
        from django.db import transaction
        
        recipe_data = validated_data.pop('recipe_ingredients', [])
        initial_stock = validated_data.get('stock', 0)

        with transaction.atomic():
            product = Product.objects.create(**validated_data)

            # Create recipe links
            for item_data in recipe_data:
                RecipeIngredient.objects.create(product=product, **item_data)

            # If the created product has an initial stock, deduct ingredients from inventory
            if initial_stock > 0 and recipe_data:
                # Determine recipe_yield (units per lote)
                try:
                    recipe_yield = int(validated_data.get('recipe_yield', 1))
                    if recipe_yield < 1:
                        recipe_yield = 1
                except Exception:
                    recipe_yield = 1

                # Calcular cuánto de cada insumo se necesita proporcionalmente
                # Si initial_stock < recipe_yield se usa la fracción (initial_stock / recipe_yield)
                try:
                    initial_stock_float = float(initial_stock)
                except Exception:
                    initial_stock_float = 0.0

                multiplier = (initial_stock_float / recipe_yield) if recipe_yield and initial_stock_float > 0 else 0.0

                for item_data in recipe_data:
                    ingredient = item_data.get('ingredient')
                    quantity_per_lot = item_data.get('quantity')
                    unit = item_data.get('unit') or ''

                    if not ingredient or not quantity_per_lot or quantity_per_lot <= 0:
                        continue

                    # Cantidad exacta requerida (SIN pérdidas automáticas)
                    required_to_deduct = float(quantity_per_lot) * float(multiplier)

                    # Para unidades indivisibles, redondear hacia arriba
                    if str(unit).lower() in ['unidades', 'unidad', 'u', 'uds']:
                        required_to_deduct = float(math.ceil(required_to_deduct))

                    # Lock ingredient for update and deduct stock
                    ingredient_to_update = Product.objects.select_for_update().get(pk=ingredient.pk)

                    if float(ingredient_to_update.stock) < required_to_deduct:
                        raise serializers.ValidationError(
                            f"No hay suficiente stock para el insumo '{ingredient.name}'. "
                            f"Necesario: {required_to_deduct:.2f}, "
                            f"Disponible: {ingredient_to_update.stock}"
                        )

                    ingredient_to_update.stock = float(ingredient_to_update.stock) - required_to_deduct
                    ingredient_to_update.save()

        return product

    def update(self, instance, validated_data):
        recipe_data = validated_data.pop('recipe_ingredients', None)
        
        # Actualizar cada campo manualmente para asegurar que se guarde
        instance.name = validated_data.get('name', instance.name)
        instance.price = validated_data.get('price', instance.price)
        instance.category = validated_data.get('category', instance.category)
        instance.stock = validated_data.get('stock', instance.stock)
        instance.description = validated_data.get('description', instance.description)
        instance.low_stock_threshold = validated_data.get('low_stock_threshold', instance.low_stock_threshold)
        instance.high_stock_multiplier = validated_data.get('high_stock_multiplier', instance.high_stock_multiplier)
        instance.recipe_yield = validated_data.get('recipe_yield', instance.recipe_yield)
        instance.loss_rate = validated_data.get('loss_rate', instance.loss_rate)
        instance.is_ingredient = validated_data.get('is_ingredient', instance.is_ingredient)
        instance.unit = validated_data.get('unit', instance.unit)
        
        instance.save()
        
        # Solo procesar ingredientes si se enviaron explícitamente
        if recipe_data is not None:
            # Si se envían ingredientes nuevos, agregarlos sin borrar los existentes
            for recipe_item_data in recipe_data:
                RecipeIngredient.objects.create(product=instance, **recipe_item_data)
        
        return instance

# Serializer para el modelo de movimiento de caja
class CashMovementSerializer(serializers.ModelSerializer):
   
    user = serializers.ReadOnlyField(source='user.username')
    
    class Meta:
        model = CashMovement
        fields = ('id', 'type', 'amount', 'description', 'timestamp', 'user', 'payment_method')
        read_only_fields = ('user',)

# Serializer para el modelo de cambio de inventario
class InventoryChangeSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username')
    
    class Meta:
        model = InventoryChange
        fields = '__all__'
        read_only_fields = ('user',)

    def validate(self, attrs):
        # Normalize quantity: accept negative for 'Salida' but store positive
        from decimal import Decimal, InvalidOperation
        change_type = attrs.get('type') or getattr(self.instance, 'type', None)
        qty = attrs.get('quantity')
        if qty is None:
            raise serializers.ValidationError({'quantity': 'La cantidad es requerida.'})

        try:
            qty_decimal = Decimal(str(qty))
        except InvalidOperation:
            raise serializers.ValidationError({'quantity': 'Cantidad inválida.'})

        if change_type == 'Salida' and qty_decimal > 0:
            # allow frontend to send negative; but accept positive and interpret as exit
            # we will treat quantity as absolute value when applying
            pass

        if qty_decimal < 0:
            qty_decimal = abs(qty_decimal)

        attrs['quantity'] = qty_decimal
        return attrs


# Serializer para los productos de una venta
class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    
    class Meta:
        model = SaleItem
        fields = ('product', 'product_name', 'quantity', 'price')

# Serializer para el modelo de venta
class SaleSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username')
    items = serializers.ListField(write_only=True, required=False)  # Para recibir los items del frontend
    sale_items = SaleItemSerializer(source='saleitem_set', many=True, read_only=True)  # Para mostrar los items

    class Meta:
        model = Sale
        fields = ('id', 'timestamp', 'total_amount', 'payment_method', 'user', 'items', 'sale_items')
        read_only_fields = ('user',)

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        sale = Sale.objects.create(**validated_data)
        
        # Procesar cada item de la venta
        for item_data in items_data:
            product_id = item_data.get('product_id')
            quantity = item_data.get('quantity')
            price = item_data.get('price')
            
            try:
                product = Product.objects.get(id=product_id)
                
                # Verificar que hay suficiente stock
                if product.stock < quantity:
                    raise serializers.ValidationError(f'Stock insuficiente para {product.name}. Disponible: {product.stock}, Requerido: {quantity}')
                
                # Crear el item de venta
                SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    quantity=quantity,
                    price=price
                )
                
                # Actualizar el stock del producto
                product.stock -= quantity
                product.save()
                
                print(f'✅ Stock actualizado: {product.name} - Nuevo stock: {product.stock}')
                
            except Product.DoesNotExist:
                raise serializers.ValidationError(f'Producto con ID {product_id} no encontrado')
        
        return sale

# Serializer para consultas de usuario
class UserQuerySerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username')
    
    class Meta:
        model = UserQuery
        fields = '__all__'
        read_only_fields = ('user', 'created_at', 'updated_at')


# Serializer para compras
class PurchaseSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username')
    approved_by = serializers.ReadOnlyField(source='approved_by.username', allow_null=True)
    approved_by_name = serializers.ReadOnlyField(source='approved_by.username', allow_null=True)
    supplier_name = serializers.ReadOnlyField(source='supplier')
    total = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'user', 'status', 'approved_by', 'approved_at')

    def get_total(self, obj):
        from decimal import Decimal
        if isinstance(obj.items, list):
            total = Decimal('0')
            for item in obj.items:
                qty = item.get('quantity') or item.get('qty') or 0
                unit_price = item.get('unitPrice') or item.get('unit_price') or item.get('price') or 0
                try:
                    total += Decimal(str(qty)) * Decimal(str(unit_price))
                except Exception:
                    continue
            return total
        return obj.total_amount

#Serializador para  un solo articulo dentro de un pedido
class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ('id', 'product_name', 'quantity', 'unit_price', 'total')


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    user = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Order
        fields = ('id', 'customer_name', 'fecha_para_la_que_se_quiere_el_pedido', 'payment_method', 'items', 'total_amount', 'notes', 'status', 'fecha_de_orden_del_pedido', 'user')
        read_only_fields = ('id', 'fecha_de_orden_del_pedido', 'user')

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        order = Order.objects.create(**validated_data)
        total = 0
        for item in items_data:
            qty = item.get('quantity', 1)
            unit = item.get('unit_price', 0)
            line_total = qty * unit
            OrderItem.objects.create(order=order, product_name=item.get('product_name', ''), quantity=qty, unit_price=unit, total=line_total)
            total += line_total
        order.total_amount = total
        order.save()
        return order


# Serializer para auditoría de cambios de inventario (restaurado)
class InventoryChangeAuditSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = getattr(__import__('api.models', fromlist=['InventoryChangeAudit']), 'InventoryChangeAudit')
        fields = ('id', 'inventory_change', 'product', 'product_name', 'user', 'role', 'change_type', 'quantity', 'previous_stock', 'new_stock', 'reason', 'timestamp')
        read_only_fields = ('id', 'inventory_change', 'product_name', 'user', 'previous_stock', 'new_stock', 'timestamp')

# Serializer para registros de pérdidas
class LossRecordSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = LossRecord
        fields = ['id', 'product', 'product_name', 'quantity', 'category', 'category_display', 'description', 'cost_estimate', 'timestamp', 'user', 'user_name']
        read_only_fields = ['id', 'timestamp', 'user', 'cost_estimate']

    def validate(self, data):
        product = data.get('product')
        category = data.get('category')
        
        if product and category:
            try:
                from .models import Product
                if product.category == 'Insumo':
                    valid_categories = ['empaque_danado', 'sobreuso_receta', 'vencimiento', 'cadena_frio']
                else:
                    valid_categories = ['accidente_fisico', 'contaminacion', 'vencimiento', 'cadena_frio']
                
                if category not in valid_categories:
                    raise serializers.ValidationError(f'Categoría inválida para este tipo de producto')
            except Exception as e:
                raise serializers.ValidationError(f'Error validando producto: {str(e)}')
        
        return data

    def create(self, validated_data):
        from django.db import transaction
        
        # Calcular costo estimado automáticamente
        product = validated_data['product']
        quantity_input = float(validated_data['quantity'])  # Cantidad ingresada por el usuario
        
        # Convertir la cantidad según la unidad del producto
        if product.unit == 'g':  # Si el producto está en gramos
            # El usuario ingresó en kilos, convertir a gramos para descontar del stock
            quantity_to_subtract = quantity_input * 1000  # 1 kg = 1000 g
            unit_display = f"{quantity_input} kg"
        elif product.unit == 'ml':  # Si el producto está en mililitros
            # El usuario ingresó en litros, convertir a mililitros para descontar del stock
            quantity_to_subtract = quantity_input * 1000  # 1 l = 1000 ml
            unit_display = f"{quantity_input} l"
        else:  # Para unidades
            quantity_to_subtract = quantity_input
            unit_display = f"{quantity_input} unidades"
        
        # El costo se calcula basado en la cantidad ingresada por el usuario (no la convertida)
        # porque el precio está en las unidades que ve el usuario (kg/litros/unidades)
        validated_data['cost_estimate'] = float(product.price) * quantity_input
        
        with transaction.atomic():
            # Crear registro de pérdida
            loss_record = super().create(validated_data)
            
            # Actualizar stock del producto (restar la cantidad convertida)
            product.stock = float(product.stock) - quantity_to_subtract
            if product.stock < 0:
                product.stock = 0
            product.save()
            
            # Crear registro en InventoryChange para auditoría
            from .models import InventoryChange
            InventoryChange.objects.create(
                product=product,
                type='Salida',
                quantity=quantity_to_subtract,  # Registrar la cantidad real descontada
                reason=f'Pérdida: {loss_record.get_category_display()} ({unit_display}) - {loss_record.description or "Sin descripción"}',
                user=validated_data.get('user')
            )
            
        return loss_record

# Serializers para producción
class ProductionItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = __import__('api.models', fromlist=['ProductionItem']).ProductionItem
        fields = ['id', 'product', 'product_name', 'quantity']
        read_only_fields = ['id', 'product_name']

class ProductionSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username')
    items = ProductionItemSerializer(many=True, read_only=True)

    class Meta:
        model = __import__('api.models', fromlist=['Production']).Production
        fields = ['id', 'user', 'created_at', 'total_units', 'items']
        read_only_fields = ['id', 'user', 'created_at', 'total_units', 'items']

class LowStockReportSerializer(serializers.ModelSerializer):
    reported_by = serializers.ReadOnlyField(source='reported_by.username')
    product_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Product.objects.all(),
        source='products',
        write_only=True
    )
    products_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LowStockReport
        fields = ('id', 'product_ids', 'products_detail', 'message', 'reported_by', 'created_at', 'is_resolved')
        read_only_fields = ('id', 'reported_by', 'created_at', 'products_detail')

    def get_products_detail(self, obj):
        products = obj.products.all()
        return [{'id': p.id, 'name': p.name, 'category': p.category} for p in products]

    def create(self, validated_data):
        products = validated_data.pop('products', [])
        report = LowStockReport.objects.create(**validated_data)
        report.products.set(products)
        return report
