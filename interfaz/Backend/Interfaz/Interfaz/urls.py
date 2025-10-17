"""
URL configuration for Interfaz project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.urls import path, include 
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from api.views import (
    UserViewSet, ProductViewSet, CashMovementViewSet, 
    InventoryChangeViewSet, SaleViewSet, SaleCreate,
    UserListCreate, UserDestroy, login_view, ExportDataView,
    UserQueryViewSet, SupplierViewSet, UserStorageViewSet, CurrentUserView,
    LowStockReportCreateView, LowStockReportListView, LowStockReportUpdateView
)
from api.views import RoleViewSet
from api.views import PurchaseViewSet, OrderViewSet, refresh_from_cookie, logout_view
from api.views import PurchaseViewSet
from api.views import OrderViewSet
from django.shortcuts import redirect
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


router = DefaultRouter()
router.register(r'userstorage', UserStorageViewSet, basename='userstorage')
router.register(r'users', UserViewSet, basename='user')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'cash-movements', CashMovementViewSet, basename='cash-movement')
router.register(r'inventory-changes', InventoryChangeViewSet, basename='inventory-change')
router.register(r'sales', SaleViewSet, basename='sale')
router.register(r'user-queries', UserQueryViewSet, basename='user-query')
router.register(r'purchases', PurchaseViewSet, basename='purchase')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'inventory-change-audits', __import__('api.views', fromlist=['InventoryChangeAuditViewSet']).InventoryChangeAuditViewSet, basename='inventory-change-audit')


def root_redirect(request):
    return redirect('/api/')

urlpatterns = [
    path('', root_redirect),
    path('admin/', admin.site.urls),
    # URLs específicas primero para evitar conflictos
    path('api/users/me/', CurrentUserView.as_view(), name='user-me'),
    path('api/users/create/', UserListCreate.as_view(), name='user-list-create'),
    path('api/users/<int:pk>/delete/', UserDestroy.as_view(), name='user-delete'),
    path('api/sales/create/', SaleCreate.as_view(), name='sale-create'),
    # Legacy login endpoint used by the app (email/password) - keeps custom behavior
    path('api/auth/login/', login_view, name='login'),
    # Standard JWT token endpoints expected by the frontend
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/refresh-cookie/', refresh_from_cookie, name='refresh-from-cookie'),
    path('api/logout/', logout_view, name='logout'),
    path('api/export-data/', ExportDataView.as_view(), name='export-data'),
    # Low stock reports
    path('api/low-stock-reports/', LowStockReportListView.as_view(), name='low-stock-report-list'),
    path('api/low-stock-reports/create/', LowStockReportCreateView.as_view(), name='low-stock-report-create'),
    path('api/low-stock-reports/<int:pk>/update/', LowStockReportUpdateView.as_view(), name='low-stock-report-update'),
    # Router general después
    path('api/', include(router.urls)),
]

# Servir archivos estáticos en desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
