import re
import json
import os

from django.http import HttpResponse, HttpResponseRedirect, HttpResponseBadRequest, Http404, HttpResponseForbidden, JsonResponse
from django.utils.http import is_safe_url
from django.views.decorators.http import require_http_methods, require_GET
from django.views.decorators.cache import cache_control, never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.template.response import TemplateResponse
from django.contrib.auth import authenticate, views as auth_views, logout as auth_logout, login as auth_login
from django.contrib.auth.forms import AuthenticationForm
from django.conf import settings
from django import forms
from django.db import connection, transaction
from django.urls import URLPattern, URLResolver

from specifyweb.specify.models import Collection, Spversion,Agent, Institution, Specifyuser, Spprincipal
from specifyweb.specify.serialize_datamodel import datamodel_to_json
from specifyweb.specify.views import login_maybe_required
from specifyweb.specify.schema import base_schema
from specifyweb.specify.specify_jar import specify_jar

from .app_resource import get_app_resource
from .viewsets import get_view
from .schema_localization import get_schema_localization
from .remote_prefs import get_remote_prefs

urlconf = __import__(settings.ROOT_URLCONF, {}, {}, [''])

def set_collection_cookie(response, collection_id):
    response.set_cookie('collection', str(collection_id), max_age=365*24*60*60)

def users_collections(cursor, user_id):
    cursor.execute("""
    select distinct c.usergroupscopeid, c.collectionname from collection c
    inner join spprincipal p on p.usergroupscopeid = c.usergroupscopeid
    inner join specifyuser_spprincipal up on up.spprincipalid = p.spprincipalid
    inner join specifyuser u on u.specifyuserid = up.specifyuserid and p.grouptype is null
    where up.specifyuserid = %s
    """, [user_id])

    return list(cursor.fetchall())

def set_users_collections(cursor, user, collectionids):
    with transaction.atomic():
        cursor.execute("delete from specifyuser_spprincipal where specifyuserid = %s", [user.id])
        cursor.execute('delete from spprincipal where grouptype is null and spprincipalid not in ('
                       'select spprincipalid from specifyuser_spprincipal)')

        for collectionid in collectionids:
            principal = Spprincipal.objects.create(
                groupsubclass='edu.ku.brc.af.auth.specify.principal.UserPrincipal',
                grouptype=None,
                name=user.name,
                priority=80,
            )
            cursor.execute('update spprincipal set usergroupscopeid = %s where spprincipalid = %s',
                           [collectionid, principal.id])
            cursor.execute('insert specifyuser_spprincipal(SpecifyUserID, SpPrincipalID) '
                           'values (%s, %s)', [user.id, principal.id])

@login_maybe_required
@require_http_methods(['GET', 'PUT'])
@never_cache
def user_collection_access(request, userid):
    """Returns (GET) or sets (PUT) the list of collections user <userid>
    can log into. Requesting user must be an admin."""
    if not request.specify_user.is_admin():
        return HttpResponseForbidden()
    cursor = connection.cursor()

    if request.method == 'PUT':
        collections = json.loads(request.body)
        user = Specifyuser.objects.get(id=userid)
        set_users_collections(cursor, user, collections)

    collections = users_collections(cursor, userid)
    return HttpResponse(json.dumps([row[0] for row in collections]),
                        content_type="application/json")

class CollectionChoiceField(forms.ChoiceField):
    widget = forms.RadioSelect
    def label_from_instance(self, obj):
        return obj.collectionname

@login_maybe_required
@require_http_methods(['GET', 'POST'])
@never_cache
def choose_collection(request):
    "The HTML page for choosing which collection to log into. Presented after the main auth page."
    redirect_to = (request.POST if request.method == "POST" else request.GET).get('next', '')
    redirect_resp = HttpResponseRedirect(
        redirect_to if is_safe_url(url=redirect_to, allowed_hosts=request.get_host())
        else settings.LOGIN_REDIRECT_URL
    )

    available_collections = users_collections(connection.cursor(), request.specify_user.id)

    if len(available_collections) < 1:
        auth_logout(request)
        return TemplateResponse(request, 'choose_collection.html', context={'next': redirect_to})

    if len(available_collections) == 1:
        set_collection_cookie(redirect_resp, available_collections[0][0])
        return redirect_resp

    class Form(forms.Form):
        collection = CollectionChoiceField(
            choices=available_collections,
            initial=request.COOKIES.get('collection', None))

    if request.method == 'POST':
        form = Form(data=request.POST)
        if form.is_valid():
            set_collection_cookie(redirect_resp, form.cleaned_data['collection'])
            return redirect_resp
    else:
        form = Form()

    context = {'form': form, 'next': redirect_to}
    return TemplateResponse(request, 'choose_collection.html', context)

@require_http_methods(['GET', 'PUT'])
@never_cache
@ensure_csrf_cookie
def api_login(request):
    """An API endpoint for logging in. GET returns the currently logged in user/collection if any.
    PUT logs into the request collection if possible.
    """
    if request.method == 'PUT':
        data = json.load(request)
        if any(data[key] is None for key in 'username password collection'.split()):
            auth_logout(request)
            return HttpResponse('', status=204)

        user = authenticate(username=data['username'],
                            password=data['password'])
        if user is None:
            return HttpResponseForbidden()
        auth_login(request, user)

        try:
            collection = Collection.objects.get(id=data['collection'])
        except Collection.DoesNotExist:
            return HttpResponseBadRequest('collection %s does not exist' % data['collection'])
        response = HttpResponse('', status=204)
        set_collection_cookie(response, collection.id)
        return response

    return HttpResponse(json.dumps(dict(
        collections={c.collectionname: c.id for c in Collection.objects.all()},
        username=None,
        password=None,
        collection=None)), content_type='application/json')

@login_maybe_required
@require_http_methods(['GET', 'POST'])
@never_cache
def collection(request):
    """Allows the frontend to query or set the logged in collection."""
    current = request.COOKIES.get('collection', None)
    available_collections = users_collections(connection.cursor(), request.specify_user.id)
    if request.method == 'POST':
        try:
            collection = Collection.objects.get(id=int(request.body))
        except ValueError:
            return HttpResponseBadRequest('bad collection id', content_type="text/plain")
        except Collection.DoesNotExist:
            return HttpResponseBadRequest('collection does not exist', content_type="text/plain")
        if collection.id not in [c[0] for c in available_collections]:
            return HttpResponseBadRequest('access denied')
        response = HttpResponse('ok')
        set_collection_cookie(response, collection.id)
        return response
    else:
        response = dict(available=available_collections, current=(current and int(current)))
        return HttpResponse(json.dumps(response), content_type="application/json")

@login_maybe_required
@require_GET
@never_cache
@cache_control(max_age=86400, private=True)
def user(request):
    """Return json representation of the currently logged in SpecifyUser."""
    from specifyweb.specify.api import obj_to_data, toJson
    data = obj_to_data(request.specify_user)
    data['isauthenticated'] = request.user.is_authenticated
    data['available_collections'] = users_collections(connection.cursor(), request.specify_user.id)
    data['agent'] = obj_to_data(request.specify_user_agent)
    if settings.RO_MODE or not request.user.is_authenticated:
        data['usertype'] = "readonly"
    return HttpResponse(toJson(data), content_type='application/json')

@login_maybe_required
@require_GET
@never_cache
def domain(request):
    """Return the context hierarchy of the logged in collection."""
    collection = request.specify_collection
    domain = {
        'collection': collection.id,
        'discipline': collection.discipline.id,
        'division': collection.discipline.division.id,
        'institution': collection.discipline.division.institution.id,
        'embeddedCollectingEvent': collection.isembeddedcollectingevent,
        'embeddedPaleoContext': collection.discipline.ispaleocontextembedded,
        'paleoContextChildTable': collection.discipline.paleocontextchildtable,
        'catalogNumFormatName': collection.catalognumformatname,
        }

    return HttpResponse(json.dumps(domain), content_type='application/json')

@login_maybe_required
@require_GET
@cache_control(max_age=86400, private=True)
def app_resource(request):
    """Return a Specify app resource by name taking into account the logged in user and collection."""
    try:
        resource_name = request.GET['name']
    except:
        raise Http404()
    result = get_app_resource(request.specify_collection,
                              request.specify_user,
                              resource_name)
    if result is None: raise Http404()
    resource, mimetype = result
    return HttpResponse(resource, content_type=mimetype)


@login_maybe_required
@require_GET
@cache_control(max_age=86400, private=True)
def available_related_searches(request):
    """Return a list of the available 'related' express searches."""
    from specifyweb.express_search import related_searches
    from specifyweb.express_search.views import get_express_search_config

    express_search_config = get_express_search_config(request.specify_collection, request.specify_user)
    active = [int(q.find('id').text)
              for q in express_search_config.findall('relatedQueries/relatedquery')
              if q.attrib.get('isactive', None) == 'true'  or q.find("[isActive='true']")]

    result = [name for name in related_searches.__all__
              if getattr(related_searches, name).id in active]

    return HttpResponse(json.dumps(result), content_type='application/json')

datamodel_json = None

@require_GET
@login_maybe_required
@cache_control(max_age=86400, public=True)
def datamodel(request):
    "Returns a JSON representation of the Specify datamodel."
    from specifyweb.specify.models import datamodel
    global datamodel_json
    if datamodel_json is None:
        datamodel_json = datamodel_to_json(datamodel)

    return HttpResponse(datamodel_json, content_type='application/json')

@require_GET
@login_maybe_required
@cache_control(max_age=86400, private=True)
def schema_localization(request):
    """Return the schema localization information for the logged in collection."""
    sl = get_schema_localization(request.specify_collection, 0)
    return HttpResponse(sl, content_type='application/json')

@require_GET
@login_maybe_required
@cache_control(max_age=86400, private=True)
def wb_schema_localization(request):
    """Return the WB schema localization information for the logged in collection."""
    sl = get_schema_localization(request.specify_collection, 1)
    return HttpResponse(sl, content_type='application/json')

@require_GET
@login_maybe_required
@cache_control(max_age=86400, private=True)
def view(request):
    """Return a Specify view definition by name taking into account the logged in user and collection."""
    if 'collectionid' in request.GET:
        # Allow a URL parameter to override the logged in collection.
        collection = Collection.objects.get(id=request.GET['collectionid'])
    else:
        collection = request.specify_collection

    try:
        view_name = request.GET['name']
    except:
        raise Http404()
    data = get_view(collection, request.specify_user, view_name)

    return HttpResponse(json.dumps(data), content_type="application/json")

@require_GET
@login_maybe_required
@cache_control(max_age=86400, private=True)
def remote_prefs(request):
    "Return the 'remoteprefs' java properties file from the database."
    return HttpResponse(get_remote_prefs(), content_type='text/x-java-properties')

@require_GET
@cache_control(max_age=86400, public=True)
def system_info(request):
    "Return various information about this Specify instance."
    spversion = Spversion.objects.get()
    collection = request.specify_collection
    discipline = collection.discipline if collection is not None else None
    institution = Institution.objects.get()

    info = dict(
        version=settings.VERSION,
        specify6_version=re.findall(r'SPECIFY_VERSION=(.*)', specify_jar.read('resources_en.properties').decode('utf-8'))[0],
        database_version=spversion.appversion,
        schema_version=spversion.schemaversion,
        stats_url=settings.STATS_URL,
        database=settings.DATABASE_NAME,
        institution=institution.name,
        discipline=discipline and discipline.name,
        collection=collection and collection.collectionname,
        isa_number=collection and collection.isanumber,
        )
    return HttpResponse(json.dumps(info), content_type='application/json')

PATH_GROUP_RE = re.compile(r'\(\?P<([^>]+)>[^\)]*\)')

def parse_pattern(pattern):
    p_str = str(pattern.pattern)
    params = []
    for match in PATH_GROUP_RE.finditer(p_str):
        p_str = p_str.replace(match.group(0), "{%s}" % match.group(1), 1)
        params.append(match.group(1))

    return p_str.strip('^$'), params

# most tags are generated automatically based on the URL, but here are some
# exceptions:
tagMapper = {
    '/api/specify_tree/': 'specify_tree',
    '/api/workbench/': 'workbench',
}

def create_tag(path):
    for tag_filter, tag_name in tagMapper.items():
        if path.startswith(tag_filter):
            return tag_name

    path_parts = [part for part in os.path.dirname(path).split('/') if part]
    return path_parts[0] if len(path_parts) > 0 else '/'

def get_tags(endpoints):
    tag_names = sorted({
        endpoint['get']['tags'][0] for endpoint in endpoints.values()
    })

    return [
        dict(
            name=tag_name,
            description='TBD'
        ) for tag_name in tag_names
    ]

endpoints_to_exclude = [
    '/api/specify/'
]

def get_endpoints(patterns, prefix="/", preparams=[]):
    for p in patterns:
        path, params = parse_pattern(p)
        complete_path = prefix + path

        if [
            True for filter in endpoints_to_exclude if complete_path.startswith(filter)
        ]:
            continue

        tag = create_tag(complete_path)
        if isinstance(p, URLPattern):
            yield (complete_path, {
                'parameters': [
                    {
                        'name': param,
                        'in': 'path',
                        'required': True,
                        'schema': {
                            'type': 'string'
                        }
                    }
                    for param in preparams + params
                ],
                'get': {
                    **({
                            'summary': 'TBD',
                            'description': p.callback.__doc__
                       } if p.callback.__doc__ else { }),
                    'tags': [tag],
                    'responses': {
                        '200': {
                            'description': 'TBD'
                        }
                    }
                },
            })
        else:
            yield from get_endpoints(p.url_patterns, prefix + path, preparams + params)

@require_GET
@cache_control(max_age=86400, public=True)
def api_endpoints(request):
    """Returns a JSON description of all endpoints served."""

    endpoints = dict(get_endpoints(urlconf.urlpatterns))
    tags = list(get_tags(endpoints))

    spec = {
        **base_schema(),
        **dict(
            tags=tags,
            paths=endpoints
        )
    }

    return JsonResponse(spec)
