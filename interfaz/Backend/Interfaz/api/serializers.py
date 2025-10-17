# backend/api/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Product, CashMovement, InventoryChange, Sale, SaleItem, Role, UserQuery, Supplier, UserStorage, LowStockReport
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
from .models import Purchase
from .models import Order, OrderItem

User = get_user_model()  # Usa el modelo de usuario personalizado

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
        fields = ('id', 'username', 'email', 'role', 'role_id', 'is_active')
        read_only_fields = ('is_active',)

# Serializer para que el Gerente actualice usuarios (SIN CONTRASEÑA)
class UserUpdateSerializer(serializers.ModelSerializer):
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', required=False, allow_null=True
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'role_id', 'is_active')
        extra_kwargs = {
            'username': {'required': False},
            'email': {'required': False},
            'is_active': {'required': False}
        }

    def update(self, instance, validated_data):
        # El rol se maneja a través de role_id
        instance = super().update(instance, validated_data)
        return instance


# Serializer para crear usuarios (incluye el campo de contraseña)
class UserCreateSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'role_name')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        role_name = validated_data.pop('role_name', 'Cajero')
        
        # Buscar o crear el rol
        role, created = Role.objects.get_or_create(name=role_name)
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=role
        )
        return user

# Serializer para el modelo de producto
class ProductSerializer(serializers.ModelSerializer):
    estado = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = '__all__'
        # Agregamos 'estado' como campo extra
        extra_fields = ['estado']

    def get_estado(self, obj):
        # Lógica: Activo si stock > 0, Inactivo si stock == 0
        if obj.stock > 0:
            return 'Activo'
        return 'Inactivo'
    
    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("El nombre del producto es obligatorio.")
        return value.strip()
    
    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("El precio debe ser mayor a 0.")
        return value
    
    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("El stock no puede ser negativo.")
        return value
    
    def validate_low_stock_threshold(self, value):
        if value < 0:
            raise serializers.ValidationError("El umbral de stock bajo no puede ser negativo.")
        return value
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
        change_type = attrs.get('type') or getattr(self.instance, 'type', None)
        qty = attrs.get('quantity')
        if qty is None:
            raise serializers.ValidationError({'quantity': 'La cantidad es requerida.'})

        try:
            qty_int = int(qty)
        except (TypeError, ValueError):
            raise serializers.ValidationError({'quantity': 'Cantidad inválida.'})

        if change_type == 'Salida' and qty_int > 0:
            # allow frontend to send negative; but accept positive and interpret as exit
            # we will treat quantity as absolute value when applying
            pass

        if qty_int < 0:
            qty_int = abs(qty_int)

        attrs['quantity'] = qty_int
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


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ('id', 'product_name', 'quantity', 'unit_price', 'total')


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    user = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Order
        fields = ('id', 'customer_name', 'date', 'payment_method', 'items', 'total_amount', 'notes', 'status', 'created_at', 'user')
        read_only_fields = ('id', 'created_at', 'user')

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

class LowStockReportSerializer(serializers.ModelSerializer):
    reported_by = serializers.ReadOnlyField(source='reported_by.username')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = LowStockReport
        fields = ('id', 'product', 'product_name', 'message', 'reported_by', 'created_at', 'is_resolved')
        read_only_fields = ('id', 'reported_by', 'created_at')